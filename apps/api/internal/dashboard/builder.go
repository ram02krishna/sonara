package dashboard

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"github.com/sonara/api/internal/models"
)

// Source is the catalogue the dashboard reads from (Spotify via app credentials).
type Source interface {
	Search(ctx context.Context, query, types string, limit, offset int, market string) (*models.SearchResult, error)
	SearchNewAlbums(ctx context.Context, market string, limit int) ([]models.AlbumSummary, error)
	GetArtist(ctx context.Context, id string) (*models.Artist, error)
}

// History is the listener's own Sonara listening history. Personalisation comes
// from what people actually play in Sonara, not from any Spotify account.
type History interface {
	Recent(ctx context.Context, userID uuid.UUID, limit int) ([]models.PlayHistoryItem, error)
	TopTracks(ctx context.Context, userID uuid.UUID, timeRange string, limit int) ([]models.Track, error)
	TopArtists(ctx context.Context, userID uuid.UUID, timeRange string, limit int) ([]models.ArtistSummary, error)
}

const maxTasteShelves = 16

// Input describes who the dashboard is for.
type Input struct {
	UserUUID uuid.UUID
	UserID   string
	Market   string // ISO country code; empty = catalogue default
	Prefs    models.Preferences
}

type Builder struct {
	src   Source
	hist  History
	cache Cache
}

func NewBuilder(src Source, hist History, cache Cache) *Builder {
	return &Builder{src: src, hist: hist, cache: cache}
}

// seed is one taste shelf to build: a title and the Spotify queries to try.
type seed struct {
	id      string
	title   string
	sub     string
	queries []string
	types   string // "track"
}

// Build assembles the dashboard. Every section is independent: if Spotify
// refuses an endpoint (403/404/429), that section is dropped and the rest of the
// page still renders. Nothing here is hardcoded content.
func (b *Builder) Build(ctx context.Context, in Input) *models.DashboardResponse {
	market := in.Market
	if in.Prefs.Country != "" {
		market = strings.ToUpper(in.Prefs.Country)
	}

	userKey := in.UserID
	if userKey == "" {
		userKey = in.UserUUID.String()
	}
	if userKey == "" {
		userKey = "guest"
	}

	fullDashKey := key(userKey, fmt.Sprintf("fulldash:%s:%s", marketScope(in, market), hashTaste(in.Prefs, nil)))
	if b.cache != nil {
		var cachedResp models.DashboardResponse
		if b.cache.Get(ctx, fullDashKey, &cachedResp) {
			return &cachedResp
		}
	}

	var (
		wg           sync.WaitGroup
		histArtists  []models.Artist
		tunedArtists []models.Artist
		tracks       []models.Track
		recent       []models.PlayHistoryItem
	)
	wg.Add(4)
	go func() {
		defer wg.Done()
		top, err := b.hist.TopArtists(ctx, in.UserUUID, "alltime", 8)
		if err != nil {
			log.Warn().Err(err).Msg("dashboard: top artists unavailable")
			return
		}
		histArtists = b.hydrateArtists(ctx, top)
	}()
	go func() {
		defer wg.Done()
		if len(in.Prefs.Artists) > 0 {
			tunedArtists = b.hydrateArtists(ctx, in.Prefs.Artists)
		}
	}()
	go func() {
		defer wg.Done()
		var err error
		if tracks, err = b.hist.TopTracks(ctx, in.UserUUID, "alltime", 20); err != nil {
			log.Warn().Err(err).Msg("dashboard: top tracks unavailable")
		}
	}()
	go func() {
		defer wg.Done()
		var err error
		if recent, err = b.hist.Recent(ctx, in.UserUUID, 30); err != nil {
			log.Warn().Err(err).Msg("dashboard: recent plays unavailable")
		}
	}()
	wg.Wait()

	// Merge listening history artists with user's tuned artists
	mergedArtists := append([]models.Artist{}, histArtists...)
	seenArtist := make(map[string]bool)
	for _, a := range histArtists {
		seenArtist[strings.ToLower(a.ID)] = true
		seenArtist[strings.ToLower(a.Name)] = true
	}
	for _, ta := range tunedArtists {
		if !seenArtist[strings.ToLower(ta.ID)] && !seenArtist[strings.ToLower(ta.Name)] {
			seenArtist[strings.ToLower(ta.ID)] = true
			seenArtist[strings.ToLower(ta.Name)] = true
			mergedArtists = append(mergedArtists, ta)
		}
	}
	allArtists := mergedArtists

	topGenres := RankGenres(allArtists)
	seeds := buildSeeds(topGenres, allArtists, in.Prefs)

	// Taste shelves and personalized new releases run in parallel; results keep seed order.
	shelves := make([][]models.Track, len(seeds))
	var (
		news         []models.AlbumSummary
		newsSubtitle string
	)
	var swg sync.WaitGroup
	for i, sd := range seeds {
		swg.Add(1)
		go func(i int, sd seed) {
			defer swg.Done()
			shelves[i] = b.runSeed(ctx, in, market, sd)
		}(i, sd)
	}

	swg.Add(1)
	go func() {
		defer swg.Done()
		news, newsSubtitle = b.fetchTasteTunedNewReleases(ctx, in, market, topGenres, allArtists)
	}()
	swg.Wait()

	resp := &models.DashboardResponse{
		Sections:    []models.DashboardSection{},
		TopGenres:   firstN(topGenres, 8),
		Market:      market,
		GeneratedAt: time.Now().UTC(),
	}
	hasHistory := len(histArtists) > 0 || len(tracks) > 0 || len(recent) > 0
	hasTunedTaste := len(in.Prefs.Languages) > 0 || len(in.Prefs.Genres) > 0 || len(in.Prefs.Artists) > 0
	resp.NeedsOnboarding = !in.Prefs.Onboarded && !hasHistory && !hasTunedTaste

	// Hero: the user's top artist (either from listening history or tuned preferences).
	if len(allArtists) > 0 {
		heroTitle := "Your top artist"
		if len(histArtists) == 0 && len(tunedArtists) > 0 {
			heroTitle = "Featured from your taste"
		}
		resp.Sections = append(resp.Sections, models.DashboardSection{
			ID: "hero", Type: "hero", Kind: "artists", Title: heroTitle, Artists: allArtists[:1],
		})
	}

	if len(recent) > 0 {
		seen := map[string]bool{}
		var rt []models.Track
		for _, it := range recent {
			if it.Track.ID == "" || seen[it.Track.ID] {
				continue
			}
			seen[it.Track.ID] = true
			rt = append(rt, it.Track)
		}
		resp.Sections = append(resp.Sections, models.DashboardSection{
			ID: "recent", Type: "carousel", Kind: "tracks", Title: "Jump back in", Subtitle: "Recently played", Tracks: firstTracks(rt, 12),
		})
	}

	if len(allArtists) > 0 {
		artistTitle := "Your top artists"
		if len(histArtists) == 0 && len(tunedArtists) > 0 {
			artistTitle = "Your tuned artists"
		}
		resp.Sections = append(resp.Sections, models.DashboardSection{
			ID: "top-artists", Type: "carousel", Kind: "artists", Title: artistTitle, Artists: firstArtists(allArtists, 15),
		})
	}

	if mix := interleave(shelves, 20); len(mix) > 0 && countNonEmpty(shelves) >= 2 {
		resp.Sections = append(resp.Sections, models.DashboardSection{
			ID: "mix", Type: "carousel", Kind: "tracks", Title: "Made around your taste", Subtitle: "A blend of what you listen to", Tracks: mix,
		})
	}

	for i, sd := range seeds {
		if len(shelves[i]) == 0 {
			continue
		}
		resp.Sections = append(resp.Sections, models.DashboardSection{
			ID: sd.id, Type: "carousel", Kind: "tracks", Title: sd.title, Subtitle: sd.sub, Tracks: shelves[i],
		})
	}

	if len(tracks) > 0 {
		resp.Sections = append(resp.Sections, models.DashboardSection{
			ID: "top-tracks", Type: "grid", Kind: "tracks", Title: "Your top tracks", Tracks: firstTracks(tracks, 10),
		})
	}

	if len(news) > 0 {
		resp.Sections = append(resp.Sections, models.DashboardSection{
			ID: "new-releases", Type: "carousel", Kind: "albums", Title: "New releases", Subtitle: newsSubtitle, Albums: news,
		})
	}

	if len(allArtists) == 0 {
		for i := range seeds {
			if len(shelves[i]) > 0 {
				resp.Sections = append([]models.DashboardSection{{
					ID: "hero", Type: "hero", Kind: "tracks", Title: seeds[i].title, Tracks: shelves[i][:1],
				}}, resp.Sections...)
				break
			}
		}
	}

	if b.cache != nil && resp != nil {
		b.cache.Set(ctx, fullDashKey, resp, 2*time.Minute)
	}
	return resp
}

// runSeed tries each query until one returns tracks. Shelves are public catalog
// data, so they are cached per market (or per user when the market is from_token).
func (b *Builder) runSeed(ctx context.Context, in Input, market string, sd seed) []models.Track {
	h := sha1.Sum([]byte(strings.Join(sd.queries, "|")))
	k := key(marketScope(in, market), "shelf:"+hex.EncodeToString(h[:6]))
	return cached(ctx, b.cache, k, 30*time.Minute, func() ([]models.Track, error) {
		var lastErr error
		for _, q := range sd.queries {
			res, err := b.src.Search(ctx, q, "track", 10, 0, market)
			if err != nil {
				lastErr = err
				continue
			}
			if res != nil && len(res.Tracks) > 0 {
				return res.Tracks, nil
			}
		}
		return nil, lastErr
	})
}

// buildSeeds merges what the user actually listens to with what they told us,
// capped so one dashboard load costs a bounded number of Spotify calls.
func buildSeeds(topGenres []string, topArtists []models.Artist, p models.Preferences) []seed {
	var seeds []seed
	used := map[string]bool{}
	add := func(s seed) {
		if len(seeds) >= maxTasteShelves || used[s.id] {
			return
		}
		used[s.id] = true
		seeds = append(seeds, s)
	}

	// 1. Explicit tuned preferences get highest priority
	for _, l := range p.Languages {
		if strings.TrimSpace(l) == "" {
			continue
		}
		add(seed{id: "lang-" + slug(l), title: titleCase(l) + " picks", sub: "From your tuned languages", queries: languageQueries(l)})
	}
	for _, g := range p.Genres {
		if strings.TrimSpace(g) == "" {
			continue
		}
		add(seed{id: "genre-" + slug(g), title: titleCase(g) + " for you", sub: "From your tuned genres", queries: genreQueries(g)})
	}
	for _, a := range p.Artists {
		if a.Name == "" {
			continue
		}
		add(seed{id: "artist-" + slug(a.Name), title: "More from " + a.Name, sub: "From your tuned artists", queries: []string{`artist:"` + a.Name + `"`, a.Name + " hits"}})
	}

	// 2. Listening history genres & artists
	for _, g := range firstN(topGenres, 3) {
		add(seed{id: "genre-" + slug(g), title: "Because you listen to " + titleCase(g), sub: "From your listening history", queries: genreQueries(g)})
	}
	for _, a := range firstArtists(topArtists, 3) {
		add(seed{id: "artist-" + slug(a.Name), title: "More like " + a.Name, sub: "From your listening history", queries: []string{a.Name + " hits", a.Name}})
	}

	// 3. Cold start fallback if no taste or history at all
	if len(seeds) == 0 {
		add(seed{id: "genre-pop", title: "Popular Hits", sub: "Trending music", queries: []string{`genre:"pop"`, "top hits"}})
		add(seed{id: "genre-hits", title: "Global Top Tracks", sub: "Featured catalogue", queries: []string{"today top hits", "global 50"}})
	}
	return seeds
}

func marketScope(in Input, market string) string {
	if market == "" {
		return "default"
	}
	return market
}

func key(scope, name string) string { return fmt.Sprintf("dash:%s:%s", scope, name) }

// cached returns cached data or fetches it; a failed fetch yields the zero value
// (section is dropped) and is logged, never propagated.
func cached[T any](ctx context.Context, c Cache, k string, ttl time.Duration, fetch func() (T, error)) T {
	var out T
	if c != nil && c.Get(ctx, k, &out) {
		return out
	}
	v, err := fetch()
	if err != nil {
		log.Warn().Err(err).Str("key", k).Msg("dashboard section unavailable; omitting")
		return out
	}
	if c != nil {
		c.Set(ctx, k, v, ttl)
	}
	return v
}

func interleave(lists [][]models.Track, max int) []models.Track {
	seen := map[string]bool{}
	var out []models.Track
	for round := 0; len(out) < max; round++ {
		progressed := false
		for _, l := range lists {
			if round < len(l) {
				progressed = true
				t := l[round]
				if t.ID != "" && !seen[t.ID] && len(out) < max {
					seen[t.ID] = true
					out = append(out, t)
				}
			}
		}
		if !progressed {
			break
		}
	}
	return out
}

func countNonEmpty(l [][]models.Track) int {
	n := 0
	for _, x := range l {
		if len(x) > 0 {
			n++
		}
	}
	return n
}

func firstN(s []string, n int) []string {
	if len(s) > n {
		return s[:n]
	}
	return s
}
func firstTracks(s []models.Track, n int) []models.Track {
	if len(s) > n {
		return s[:n]
	}
	return s
}
func firstArtists(s []models.Artist, n int) []models.Artist {
	if len(s) > n {
		return s[:n]
	}
	return s
}

func slug(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	var b strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		} else if b.Len() > 0 && !strings.HasSuffix(b.String(), "-") {
			b.WriteRune('-')
		}
	}
	return strings.Trim(b.String(), "-")
}

func titleCase(s string) string {
	words := strings.Fields(strings.TrimSpace(s))
	for i, w := range words {
		words[i] = strings.ToUpper(w[:1]) + w[1:]
	}
	return strings.Join(words, " ")
}

// fetchTasteTunedNewReleases queries Spotify for fresh albums tailored to the user's
// taste (languages, genres, artists, and listened top genres) instead of a generic global list.
func (b *Builder) fetchTasteTunedNewReleases(ctx context.Context, in Input, market string, topGenres []string, topArtists []models.Artist) ([]models.AlbumSummary, string) {
	subtitle := buildNewReleasesSubtitle(in.Prefs, topGenres)
	tasteHash := hashTaste(in.Prefs, topGenres)
	cacheKey := key(in.UserID, "new-albums:"+tasteHash)

	albums := cached(ctx, b.cache, cacheKey, 20*time.Minute, func() ([]models.AlbumSummary, error) {
		queries := buildNewReleasesQueries(in.Prefs, topGenres, topArtists)
		if len(queries) == 0 {
			queries = []string{"tag:new"}
		}

		albumLists := make([][]models.AlbumSummary, len(queries))
		var nwg sync.WaitGroup
		for i, q := range queries {
			nwg.Add(1)
			go func(idx int, queryStr string) {
				defer nwg.Done()
				res, err := b.src.Search(ctx, queryStr, "album", 8, 0, market)
				if err == nil && res != nil && len(res.Albums) > 0 {
					albumLists[idx] = res.Albums
				}
			}(i, q)
		}
		nwg.Wait()

		var combined []models.AlbumSummary
		seen := make(map[string]bool)
		maxPerList := 8
		for r := 0; r < maxPerList && len(combined) < 12; r++ {
			for _, list := range albumLists {
				if r < len(list) {
					item := list[r]
					if item.ID != "" && !seen[item.ID] && len(combined) < 12 {
						seen[item.ID] = true
						combined = append(combined, item)
					}
				}
			}
		}

		if len(combined) == 0 {
			res, err := b.src.SearchNewAlbums(ctx, market, 10)
			if err == nil {
				return res, nil
			}
		}
		return combined, nil
	})

	return albums, subtitle
}

func hashTaste(p models.Preferences, topGenres []string) string {
	var parts []string
	for _, l := range p.Languages {
		parts = append(parts, "l:"+strings.ToLower(strings.TrimSpace(l)))
	}
	for _, g := range p.Genres {
		parts = append(parts, "g:"+strings.ToLower(strings.TrimSpace(g)))
	}
	for _, a := range p.Artists {
		parts = append(parts, "a:"+strings.ToLower(strings.TrimSpace(a.Name)))
	}
	for _, tg := range firstN(topGenres, 2) {
		parts = append(parts, "tg:"+strings.ToLower(strings.TrimSpace(tg)))
	}
	if len(parts) == 0 {
		return "default"
	}
	h := sha1.Sum([]byte(strings.Join(parts, "|")))
	return hex.EncodeToString(h[:8])
}

func buildNewReleasesSubtitle(p models.Preferences, topGenres []string) string {
	var tags []string
	for _, l := range p.Languages {
		if strings.TrimSpace(l) != "" {
			tags = append(tags, titleCase(l))
		}
	}
	for _, g := range p.Genres {
		if strings.TrimSpace(g) != "" {
			tags = append(tags, titleCase(g))
		}
	}
	if len(tags) == 0 && len(p.Artists) > 0 {
		for _, a := range p.Artists {
			if strings.TrimSpace(a.Name) != "" {
				tags = append(tags, a.Name)
			}
		}
	}
	if len(tags) == 0 && len(topGenres) > 0 {
		for _, tg := range firstN(topGenres, 2) {
			tags = append(tags, titleCase(tg))
		}
	}

	if len(tags) == 0 {
		return "Fresh studio releases & drops"
	}
	if len(tags) == 1 {
		return fmt.Sprintf("Fresh drops tuned to %s", tags[0])
	}
	return fmt.Sprintf("Fresh drops tuned to %s & %s", tags[0], tags[1])
}

func buildNewReleasesQueries(p models.Preferences, topGenres []string, topArtists []models.Artist) []string {
	var queries []string
	used := make(map[string]bool)

	addQuery := func(q string) {
		q = strings.TrimSpace(q)
		if q == "" || used[strings.ToLower(q)] || len(queries) >= 8 {
			return
		}
		used[strings.ToLower(q)] = true
		queries = append(queries, q)
	}

	for _, l := range p.Languages {
		if strings.TrimSpace(l) != "" {
			addQuery(newReleaseLanguageQuery(l))
		}
	}

	for _, g := range p.Genres {
		if strings.TrimSpace(g) != "" {
			addQuery(newReleaseGenreQuery(g))
		}
	}

	for _, a := range p.Artists {
		if strings.TrimSpace(a.Name) != "" {
			addQuery(newReleaseArtistQuery(a.Name))
		}
	}

	if len(queries) == 0 {
		for _, tg := range firstN(topGenres, 3) {
			addQuery(newReleaseGenreQuery(tg))
		}
		for _, ta := range firstArtists(topArtists, 2) {
			addQuery(newReleaseArtistQuery(ta.Name))
		}
	}

	// ONLY add generic "tag:new" if the user has no tuned preferences and no listening history
	if len(queries) == 0 {
		queries = append(queries, "tag:new")
	}
	return queries
}

func newReleaseLanguageQuery(lang string) string {
	l := strings.ToLower(strings.TrimSpace(lang))
	switch l {
	case "hindi":
		return "bollywood hits"
	case "punjabi":
		return "punjabi hits"
	case "tamil":
		return "tamil hits"
	case "telugu":
		return "telugu hits"
	case "malayalam":
		return "malayalam hits"
	case "kannada":
		return "kannada hits"
	case "bengali":
		return "bengali hits"
	case "marathi":
		return "marathi hits"
	case "gujarati":
		return "gujarati hits"
	case "urdu":
		return "urdu hits"
	case "korean":
		return "k-pop hits"
	case "japanese":
		return "j-pop hits"
	case "spanish":
		return "latin hits"
	case "portuguese":
		return "brazilian hits"
	case "arabic":
		return "arabic hits"
	case "french":
		return "french pop hits"
	case "german":
		return "german pop hits"
	case "turkish":
		return "turkish pop hits"
	case "english":
		return "top hits"
	default:
		return l + " hits"
	}
}

func newReleaseGenreQuery(g string) string {
	genre := strings.ToLower(strings.TrimSpace(g))
	switch genre {
	case "sufi":
		return "sufi hits"
	case "ghazal":
		return "ghazal hits"
	case "devotional":
		return "devotional hits"
	case "lofi", "lo-fi":
		return "hindi lofi"
	case "edm":
		return "edm hits"
	case "hip hop", "hip-hop":
		return "hip hop hits"
	case "r&b", "r-b":
		return "r&b hits"
	case "afrobeats":
		return "afrobeats hits"
	case "classical":
		return "classical hits"
	case "indie":
		return "indie hits"
	case "rock":
		return "rock classics"
	case "pop":
		return "pop hits"
	default:
		return genre + " hits"
	}
}

func newReleaseArtistQuery(name string) string {
	return strings.TrimSpace(name) + " hits"
}

// hydrateArtists loads artist details (image, genres) for the listener's top
// artists. Artist data is public catalogue data, so it is cached across users.
func (b *Builder) hydrateArtists(ctx context.Context, top []models.ArtistSummary) []models.Artist {
	out := make([]models.Artist, len(top))
	var wg sync.WaitGroup
	for i, a := range top {
		out[i] = models.Artist{ID: a.ID, Name: a.Name, URI: a.URI}
		wg.Add(1)
		go func(i int, id string) {
			defer wg.Done()
			if id == "" {
				return
			}
			full := cached(ctx, b.cache, "artist:"+id, 24*time.Hour, func() (models.Artist, error) {
				a, err := b.src.GetArtist(ctx, id)
				if err != nil || a == nil {
					return models.Artist{}, err
				}
				return *a, nil
			})
			if full.ID != "" {
				out[i] = full
			}
		}(i, a.ID)
	}
	wg.Wait()
	return out
}
