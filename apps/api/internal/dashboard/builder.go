package dashboard

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/sonara/api/internal/models"
)

// Source is the subset of the music provider the dashboard needs (easy to fake in tests).
type Source interface {
	GetTopArtists(ctx context.Context, accessToken string, timeRange string, limit int) ([]models.Artist, error)
	GetTopTracks(ctx context.Context, accessToken string, timeRange string, limit int) ([]models.Track, error)
	GetRecentlyPlayed(ctx context.Context, accessToken string, limit int) ([]models.PlayHistoryItem, error)
	Search(ctx context.Context, accessToken string, query string, types string, limit int, market string) (*models.SearchResult, error)
	SearchNewAlbums(ctx context.Context, accessToken string, market string, limit int) ([]models.AlbumSummary, error)
}

const maxTasteShelves = 5

// Input describes who the dashboard is for.
type Input struct {
	UserID string
	Token  string // user's Spotify access token
	Market string // "from_token" or an ISO code
	Prefs  models.Preferences
}

type Builder struct {
	src   Source
	cache Cache
}

func NewBuilder(src Source, cache Cache) *Builder { return &Builder{src: src, cache: cache} }

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
	if market == "" {
		market = "from_token"
	}
	if in.Prefs.Country != "" {
		market = strings.ToUpper(in.Prefs.Country)
	}

	var (
		wg      sync.WaitGroup
		artists []models.Artist
		tracks  []models.Track
		recent  []models.PlayHistoryItem
		news    []models.AlbumSummary
	)
	wg.Add(4)
	go func() {
		defer wg.Done()
		artists = cached(ctx, b.cache, key(in.UserID, "top-artists"), time.Hour, func() ([]models.Artist, error) {
			return b.src.GetTopArtists(ctx, in.Token, "medium_term", 20)
		})
	}()
	go func() {
		defer wg.Done()
		tracks = cached(ctx, b.cache, key(in.UserID, "top-tracks"), time.Hour, func() ([]models.Track, error) {
			return b.src.GetTopTracks(ctx, in.Token, "medium_term", 20)
		})
	}()
	go func() {
		defer wg.Done()
		recent = cached(ctx, b.cache, key(in.UserID, "recent"), 2*time.Minute, func() ([]models.PlayHistoryItem, error) {
			return b.src.GetRecentlyPlayed(ctx, in.Token, 30)
		})
	}()
	go func() {
		defer wg.Done()
		news = cached(ctx, b.cache, key(marketScope(in, market), "new-albums"), 30*time.Minute, func() ([]models.AlbumSummary, error) {
			return b.src.SearchNewAlbums(ctx, in.Token, market, 10)
		})
	}()
	wg.Wait()

	topGenres := RankGenres(artists)
	seeds := buildSeeds(topGenres, artists, in.Prefs)

	// Taste shelves run in parallel; results keep seed order.
	shelves := make([][]models.Track, len(seeds))
	var swg sync.WaitGroup
	for i, sd := range seeds {
		swg.Add(1)
		go func(i int, sd seed) {
			defer swg.Done()
			shelves[i] = b.runSeed(ctx, in, market, sd)
		}(i, sd)
	}
	swg.Wait()

	resp := &models.DashboardResponse{
		Sections:    []models.DashboardSection{},
		TopGenres:   firstN(topGenres, 8),
		Market:      market,
		GeneratedAt: time.Now().UTC(),
	}
	hasHistory := len(artists) > 0 || len(tracks) > 0 || len(recent) > 0
	resp.NeedsOnboarding = !in.Prefs.Onboarded && !hasHistory

	// Hero: the user's #1 artist when known.
	if len(artists) > 0 {
		resp.Sections = append(resp.Sections, models.DashboardSection{
			ID: "hero", Type: "hero", Kind: "artists", Title: "Your top artist", Artists: artists[:1],
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

	if len(artists) > 0 {
		resp.Sections = append(resp.Sections, models.DashboardSection{
			ID: "top-artists", Type: "carousel", Kind: "artists", Title: "Your top artists", Artists: firstArtists(artists, 15),
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
			ID: "new-releases", Type: "grid", Kind: "albums", Title: "New releases", Subtitle: "Fresh on Spotify", Albums: news,
		})
	}

	// Cold start with no top artist: promote the first taste shelf's lead track to a hero.
	if len(artists) == 0 {
		for i := range seeds {
			if len(shelves[i]) > 0 {
				resp.Sections = append([]models.DashboardSection{{
					ID: "hero", Type: "hero", Kind: "tracks", Title: seeds[i].title, Tracks: shelves[i][:1],
				}}, resp.Sections...)
				break
			}
		}
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
			res, err := b.src.Search(ctx, in.Token, q, "track", 10, market)
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

	for _, g := range firstN(topGenres, 2) {
		add(seed{id: "genre-" + slug(g), title: "Because you listen to " + titleCase(g), queries: []string{`genre:"` + g + `"`, g}})
	}
	for _, l := range p.Languages {
		if strings.TrimSpace(l) == "" {
			continue
		}
		add(seed{id: "lang-" + slug(l), title: titleCase(l) + " picks", sub: "From the languages you chose", queries: languageQueries(l)})
	}
	for _, g := range p.Genres {
		if strings.TrimSpace(g) == "" {
			continue
		}
		add(seed{id: "genre-" + slug(g), title: titleCase(g) + " for you", queries: []string{`genre:"` + strings.ToLower(g) + `"`, g}})
	}
	for _, a := range p.Artists {
		if a.Name == "" {
			continue
		}
		add(seed{id: "artist-" + slug(a.Name), title: "More from " + a.Name, queries: []string{`artist:"` + a.Name + `"`}})
	}
	// Spotify may omit genres; fall back to the user's own top artists as seeds.
	if len(topGenres) == 0 {
		for _, a := range firstArtists(topArtists, 2) {
			add(seed{id: "artist-" + slug(a.Name), title: "More like " + a.Name, queries: []string{`artist:"` + a.Name + `"`}})
		}
	}
	return seeds
}

func marketScope(in Input, market string) string {
	if market == "from_token" {
		return in.UserID // from_token resolves per user, so don't share across users
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
