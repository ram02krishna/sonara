package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/sonara/api/internal/models"
	"github.com/sonara/api/internal/provider"
	"github.com/sonara/api/internal/repository"
	"github.com/sonara/api/internal/service"
)

// MusicDeps are the collaborators of MusicHandler.
type MusicDeps struct {
	Users       *repository.UserRepository
	Prefs       *repository.PreferencesRepository
	History     *repository.HistoryRepository
	Library     *repository.LibraryRepository
	Collection  *repository.CollectionRepository
	Playlists   *repository.PlaylistRepository
	Auth        *service.AuthService
	Catalog     provider.MusicProvider
	Previews    provider.PreviewProvider
	YouTube     *provider.YouTubeClient
	AuthHandler *AuthHandler
}

type MusicHandler struct {
	MusicDeps
	// kept as direct fields for sibling handlers
	userRepo  *repository.UserRepository
	prefsRepo *repository.PreferencesRepository
	provider  provider.MusicProvider

	artistMu    sync.Mutex
	artistCache map[string]cachedArtist
}

type cachedArtist struct {
	artist  models.Artist
	expires time.Time
}

func NewMusicHandler(d MusicDeps) *MusicHandler {
	return &MusicHandler{MusicDeps: d, userRepo: d.Users, prefsRepo: d.Prefs, provider: d.Catalog, artistCache: map[string]cachedArtist{}}
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, code, msg string) {
	writeJSON(w, status, map[string]interface{}{"error": code, "message": msg})
}

func upstreamError(w http.ResponseWriter, err error) {
	switch provider.StatusOf(err) {
	case http.StatusUnauthorized, http.StatusForbidden:
		writeError(w, http.StatusBadGateway, "catalog_unavailable", "The music catalogue refused the request. Check the Spotify client ID/secret and that your Spotify developer app is active.")
	case http.StatusNotFound:
		writeError(w, http.StatusNotFound, "not_found", "That item was not found in the catalogue.")
	case http.StatusTooManyRequests:
		writeError(w, http.StatusTooManyRequests, "rate_limited", "The catalogue is rate limiting us. Please try again shortly.")
	case http.StatusServiceUnavailable:
		writeError(w, http.StatusServiceUnavailable, "catalog_not_configured", err.Error())
	default:
		writeError(w, http.StatusBadGateway, "upstream_error", err.Error())
	}
}

func dbError(w http.ResponseWriter, err error) {
	if err == repository.ErrNoDatabase {
		writeError(w, http.StatusServiceUnavailable, "database_unavailable", err.Error())
		return
	}
	writeError(w, http.StatusInternalServerError, "server_error", "Something went wrong on our side.")
}

// resolveUser returns the signed-in Sonara user. There is no fallback account.
func (h *MusicHandler) resolveUser(r *http.Request) *models.User {
	id := sessionIDFromRequest(r)
	if id == "" {
		return nil
	}
	user, err := h.Auth.GetUserBySession(r.Context(), id)
	if err != nil {
		return nil
	}
	return user
}

func (h *MusicHandler) requireUser(w http.ResponseWriter, r *http.Request) (*models.User, bool) {
	user := h.resolveUser(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "unauthenticated", "Please sign in to Sonara.")
		return nil, false
	}
	return user, true
}

// marketFor picks the catalogue region: the listener's chosen region, else their account's, else the default.
func (h *MusicHandler) marketFor(r *http.Request, user *models.User) string {
	if m := strings.ToUpper(r.URL.Query().Get("market")); len(m) == 2 {
		return m
	}
	if user == nil {
		return ""
	}
	if prefs, err := h.Prefs.Get(r.Context(), user.ID); err == nil && prefs.Country != "" {
		return prefs.Country
	}
	return user.Country
}

func queryInt(r *http.Request, key string, def, max int) int {
	v, err := strconv.Atoi(r.URL.Query().Get(key))
	if err != nil || v <= 0 {
		return def
	}
	if v > max {
		return max
	}
	return v
}

// ---------- catalogue ----------

func (h *MusicHandler) Search(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		writeJSON(w, http.StatusOK, models.SearchResult{})
		return
	}
	user := h.resolveUser(r)
	res, err := h.Catalog.Search(r.Context(), q, r.URL.Query().Get("type"), queryInt(r, "limit", 10, 10), queryInt(r, "offset", 0, 990), h.marketFor(r, user))
	if err != nil {
		upstreamError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func (h *MusicHandler) GetPreview(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimSpace(r.URL.Query().Get("name"))
	if name == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "name is required")
		return
	}
	url, err := h.Previews.FindPreview(r.Context(), name, strings.TrimSpace(r.URL.Query().Get("artist")))
	if err != nil {
		writeError(w, http.StatusBadGateway, "preview_lookup_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"preview_url": url})
}

// GetVideo resolves an embeddable YouTube video through the official Data API.
func (h *MusicHandler) GetVideo(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.requireUser(w, r); !ok {
		return
	}
	if !h.YouTube.Enabled() {
		writeError(w, http.StatusNotFound, "video_not_configured", "Video playback needs a YOUTUBE_API_KEY.")
		return
	}
	v, err := h.YouTube.FindVideo(r.Context(), r.URL.Query().Get("name"), r.URL.Query().Get("artist"))
	if err != nil {
		writeError(w, http.StatusNotFound, "video_not_found", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, v)
}

// GetConfig tells the UI which optional capabilities are available.
func (h *MusicHandler) GetConfig(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"catalog_configured": h.Catalog.Configured(),
		"video_enabled":      h.YouTube.Enabled(),
	})
}

func (h *MusicHandler) artistInfo(r *http.Request, id string) (*models.Artist, error) {
	h.artistMu.Lock()
	if c, ok := h.artistCache[id]; ok && time.Now().Before(c.expires) {
		h.artistMu.Unlock()
		a := c.artist
		return &a, nil
	}
	h.artistMu.Unlock()
	a, err := h.Catalog.GetArtist(r.Context(), id)
	if err != nil {
		return nil, err
	}
	h.artistMu.Lock()
	if len(h.artistCache) > 2000 {
		h.artistCache = map[string]cachedArtist{}
	}
	h.artistCache[id] = cachedArtist{artist: *a, expires: time.Now().Add(12 * time.Hour)}
	h.artistMu.Unlock()
	return a, nil
}

func (h *MusicHandler) GetArtist(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	user := h.resolveUser(r)
	market := h.marketFor(r, user)
	artist, err := h.artistInfo(r, id)
	if err != nil {
		upstreamError(w, err)
		return
	}

	// Popular tracks: three search pages in parallel, kept only if this artist is credited.
	pages := make([][]models.Track, 3)
	var albums []models.AlbumSummary
	var wg sync.WaitGroup
	for i := range pages {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			if res, err := h.Catalog.Search(r.Context(), `artist:"`+artist.Name+`"`, "track", 10, i*10, market); err == nil {
				pages[i] = res.Tracks
			}
		}(i)
	}
	wg.Add(1)
	go func() {
		defer wg.Done()
		list, err := h.Catalog.GetArtistAlbums(r.Context(), id, market, 10)
		if err != nil || len(list) == 0 {
			if res, serr := h.Catalog.Search(r.Context(), `artist:"`+artist.Name+`"`, "album", 10, 0, market); serr == nil {
				list = res.Albums
			}
		}
		albums = list
	}()
	wg.Wait()

	tracks := []models.Track{}
	seen := map[string]bool{}
	for _, page := range pages {
		for _, t := range page {
			credited := false
			for _, a := range t.Artists {
				if a.ID == id {
					credited = true
				}
			}
			if credited && !seen[t.ID] {
				seen[t.ID] = true
				tracks = append(tracks, t)
			}
		}
	}
	following := false
	if user != nil {
		following, _ = h.Collection.Has(r.Context(), user.ID, "artist", id)
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"artist": artist, "tracks": tracks, "albums": albums, "following": following})
}

func (h *MusicHandler) GetAlbum(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	user := h.resolveUser(r)
	album, err := h.Catalog.GetAlbum(r.Context(), id, h.marketFor(r, user))
	if err != nil {
		upstreamError(w, err)
		return
	}
	saved := false
	if user != nil {
		saved, _ = h.Collection.Has(r.Context(), user.ID, "album", id)
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"album": album, "saved": saved})
}

// ---------- listening history (what Sonara knows about you) ----------

func (h *MusicHandler) GetRecentlyPlayed(w http.ResponseWriter, r *http.Request) {
	user, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	items, err := h.History.Recent(r.Context(), user.ID, queryInt(r, "limit", 30, 100))
	if err != nil {
		dbError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"items": items})
}

func (h *MusicHandler) GetTopTracks(w http.ResponseWriter, r *http.Request) {
	user, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	items, err := h.History.TopTracks(r.Context(), user.ID, r.URL.Query().Get("range"), queryInt(r, "limit", 20, 50))
	if err != nil {
		dbError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"items": items})
}

func (h *MusicHandler) GetTopArtists(w http.ResponseWriter, r *http.Request) {
	user, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	top, err := h.History.TopArtists(r.Context(), user.ID, r.URL.Query().Get("range"), queryInt(r, "limit", 20, 30))
	if err != nil {
		dbError(w, err)
		return
	}
	artists := make([]models.Artist, len(top))
	var wg sync.WaitGroup
	for i, a := range top {
		artists[i] = models.Artist{ID: a.ID, Name: a.Name, Genres: []string{}, Images: []models.Image{}}
		wg.Add(1)
		go func(i int, id string) {
			defer wg.Done()
			if full, err := h.artistInfo(r, id); err == nil {
				artists[i] = *full
			}
		}(i, a.ID)
	}
	wg.Wait()
	writeJSON(w, http.StatusOK, map[string]interface{}{"items": artists})
}

// ---------- liked songs ----------

func (h *MusicHandler) SaveTrack(w http.ResponseWriter, r *http.Request) {
	user, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	var track models.Track
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10)).Decode(&track); err != nil || track.ID == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "A track is required.")
		return
	}
	if track.URI == "" {
		track.URI = "spotify:track:" + track.ID
	}
	if err := h.Library.SaveTrack(r.Context(), user.ID, track); err != nil {
		dbError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"saved": true})
}

func (h *MusicHandler) RemoveTrack(w http.ResponseWriter, r *http.Request) {
	user, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	uri := strings.TrimSpace(r.URL.Query().Get("uri"))
	if uri == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "uri is required")
		return
	}
	if err := h.Library.RemoveTrack(r.Context(), user.ID, uri); err != nil {
		dbError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"saved": false})
}

func (h *MusicHandler) TrackSaved(w http.ResponseWriter, r *http.Request) {
	user, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	saved, err := h.Library.IsTrackSaved(r.Context(), user.ID, strings.TrimSpace(r.URL.Query().Get("uri")))
	if err != nil {
		dbError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"saved": saved})
}

func (h *MusicHandler) GetSavedTracks(w http.ResponseWriter, r *http.Request) {
	user, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	tracks, err := h.Library.GetSavedTracks(r.Context(), user.ID, queryInt(r, "limit", 500, 1000))
	if err != nil {
		dbError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"items": tracks})
}

// ---------- following artists & saved albums ----------

func (h *MusicHandler) addToCollection(kind string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok := h.requireUser(w, r)
		if !ok {
			return
		}
		id := chi.URLParam(r, "id")
		var item map[string]interface{}
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10)).Decode(&item); err != nil || item == nil {
			item = map[string]interface{}{}
		}
		item["id"] = id
		if err := h.Collection.Add(r.Context(), user.ID, kind, id, item); err != nil {
			dbError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"saved": true})
	}
}

func (h *MusicHandler) removeFromCollection(kind string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok := h.requireUser(w, r)
		if !ok {
			return
		}
		if err := h.Collection.Remove(r.Context(), user.ID, kind, chi.URLParam(r, "id")); err != nil {
			dbError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"saved": false})
	}
}

func (h *MusicHandler) listCollection(kind string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok := h.requireUser(w, r)
		if !ok {
			return
		}
		items, err := h.Collection.List(r.Context(), user.ID, kind, 100)
		if err != nil {
			dbError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"items": items})
	}
}

func (h *MusicHandler) FollowArtist() http.HandlerFunc   { return h.addToCollection("artist") }
func (h *MusicHandler) UnfollowArtist() http.HandlerFunc { return h.removeFromCollection("artist") }
func (h *MusicHandler) ListFollowing() http.HandlerFunc  { return h.listCollection("artist") }
func (h *MusicHandler) SaveAlbum() http.HandlerFunc      { return h.addToCollection("album") }
func (h *MusicHandler) UnsaveAlbum() http.HandlerFunc    { return h.removeFromCollection("album") }
func (h *MusicHandler) ListSavedAlbums() http.HandlerFunc {
	return h.listCollection("album")
}
