package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/sonara/api/internal/models"
	"github.com/sonara/api/internal/provider"
	"github.com/sonara/api/internal/repository"
	"github.com/sonara/api/internal/service"
)

type MusicHandler struct {
	userRepo    *repository.UserRepository
	prefsRepo   *repository.PreferencesRepository
	historyRepo *repository.HistoryRepository
	libraryRepo *repository.LibraryRepository
	authService *service.AuthService
	provider    provider.MusicProvider
	previews    provider.PreviewProvider
}

func NewMusicHandler(
	userRepo *repository.UserRepository,
	prefsRepo *repository.PreferencesRepository,
	historyRepo *repository.HistoryRepository,
	libraryRepo *repository.LibraryRepository,
	authService *service.AuthService,
	prov provider.MusicProvider,
	previews provider.PreviewProvider,
) *MusicHandler {
	return &MusicHandler{
		userRepo:    userRepo,
		prefsRepo:   prefsRepo,
		historyRepo: historyRepo,
		libraryRepo: libraryRepo,
		authService: authService,
		provider:    prov,
		previews:    previews,
	}
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
	case http.StatusUnauthorized:
		writeError(w, http.StatusUnauthorized, "catalog_error", "Catalog provider authentication failed.")
	case http.StatusForbidden:
		writeError(w, http.StatusForbidden, "catalog_forbidden", "Catalog provider access forbidden.")
	case http.StatusNotFound:
		writeError(w, http.StatusNotFound, "not_found", "The requested music item was not found.")
	case http.StatusTooManyRequests:
		writeError(w, http.StatusTooManyRequests, "rate_limited", "Catalog rate limit reached. Please try again shortly.")
	default:
		writeError(w, http.StatusBadGateway, "upstream_error", err.Error())
	}
}

// resolveUser retrieves the current Sonara user from session cookie
func (h *MusicHandler) resolveUser(r *http.Request) (*models.User, error) {
	cookie, err := r.Cookie("sonara_session")
	if err != nil || cookie.Value == "" {
		return nil, http.ErrNoCookie
	}
	user, err := h.authService.GetUserBySession(r.Context(), cookie.Value)
	if err != nil || user == nil {
		return nil, http.ErrNoCookie
	}
	return user, nil
}

// resolveToken returns the Spotify App Token and the Sonara user
func (h *MusicHandler) resolveToken(r *http.Request) (string, *models.User, error) {
	user, _ := h.resolveUser(r)
	appToken, err := h.provider.GetAppToken(r.Context())
	if err != nil {
		return "", user, err
	}
	return appToken, user, nil
}

// requireUser ensures an active Sonara user session
func (h *MusicHandler) requireUser(w http.ResponseWriter, r *http.Request) (string, *models.User, bool) {
	user, err := h.resolveUser(r)
	if err != nil || user == nil {
		writeError(w, http.StatusUnauthorized, "unauthenticated", "Please sign in to Sonara.")
		return "", nil, false
	}
	appToken, _ := h.provider.GetAppToken(r.Context())
	return appToken, user, true
}

func (h *MusicHandler) GetMe(w http.ResponseWriter, r *http.Request) {
	_, user, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	writeJSON(w, http.StatusOK, user)
}

func queryLimit(r *http.Request, def int) int {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 {
		return def
	}
	return limit
}

func (h *MusicHandler) GetTopArtists(w http.ResponseWriter, r *http.Request) {
	token, user, ok := h.requireUser(w, r)
	if !ok {
		return
	}

	// First try user taste preferences
	if prefs, err := h.prefsRepo.Get(r.Context(), user.ID); err == nil && len(prefs.Artists) > 0 {
		artists := make([]models.Artist, 0, len(prefs.Artists))
		for _, a := range prefs.Artists {
			artists = append(artists, models.Artist{
				ID:   a.ID,
				Name: a.Name,
				URI:  a.URI,
			})
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"items": artists})
		return
	}

	// Catalog fallback: trending artists via catalog search
	res, err := h.provider.Search(r.Context(), token, "genre:pop", "artist", queryLimit(r, 20), user.Country)
	if err != nil {
		upstreamError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"items": res.Artists})
}

func (h *MusicHandler) GetTopTracks(w http.ResponseWriter, r *http.Request) {
	token, user, ok := h.requireUser(w, r)
	if !ok {
		return
	}

	// Search top hits from catalog
	query := "top hits"
	if prefs, err := h.prefsRepo.Get(r.Context(), user.ID); err == nil && len(prefs.Genres) > 0 {
		query = "genre:" + prefs.Genres[0]
	}
	res, err := h.provider.Search(r.Context(), token, query, "track", queryLimit(r, 20), user.Country)
	if err != nil {
		upstreamError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"items": res.Tracks})
}

func (h *MusicHandler) GetRecentlyPlayed(w http.ResponseWriter, r *http.Request) {
	_, _, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	// Return empty recent items (handled via Sonara play_history in stats)
	writeJSON(w, http.StatusOK, map[string]interface{}{"items": []models.PlayHistoryItem{}})
}

func (h *MusicHandler) Search(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		writeJSON(w, http.StatusOK, models.SearchResult{})
		return
	}
	token, user, _ := h.resolveToken(r)
	market := r.URL.Query().Get("market")
	if market == "" && user != nil {
		market = user.Country
	}
	res, err := h.provider.Search(r.Context(), token, q, r.URL.Query().Get("type"), queryLimit(r, 15), market)
	if err != nil {
		upstreamError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func (h *MusicHandler) GetPreview(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimSpace(r.URL.Query().Get("name"))
	artist := strings.TrimSpace(r.URL.Query().Get("artist"))
	if name == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "name is required")
		return
	}
	url, err := h.previews.FindPreview(r.Context(), name, artist)
	if err != nil {
		writeError(w, http.StatusBadGateway, "preview_lookup_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"preview_url": url})
}

func (h *MusicHandler) GetArtist(w http.ResponseWriter, r *http.Request) {
	token, user, _ := h.resolveToken(r)
	artistID := chi.URLParam(r, "id")
	artist, err := h.provider.GetArtist(r.Context(), token, artistID)
	if err != nil {
		upstreamError(w, err)
		return
	}

	market := "US"
	if user != nil && user.Country != "" {
		market = user.Country
	}
	var tracks []models.Track
	if res, serr := h.provider.Search(r.Context(), token, `artist:"`+artist.Name+`"`, "track", 15, market); serr == nil {
		tracks = res.Tracks
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"artist": artist, "tracks": tracks})
}

func (h *MusicHandler) GetPlaylist(w http.ResponseWriter, r *http.Request) {
	token, _, _ := h.resolveToken(r)
	playlistID := chi.URLParam(r, "id")
	pl, tracks, err := h.provider.GetPlaylist(r.Context(), token, playlistID)
	if err != nil {
		upstreamError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"playlist": pl, "tracks": tracks})
}

func (h *MusicHandler) GetMyPlaylists(w http.ResponseWriter, r *http.Request) {
	_, _, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	// Return user's Sonara playlists
	writeJSON(w, http.StatusOK, map[string]interface{}{"items": []models.PlaylistSummary{}})
}

func (h *MusicHandler) SaveTrack(w http.ResponseWriter, r *http.Request) {
	_, user, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	uri := strings.TrimSpace(r.URL.Query().Get("uri"))
	if uri == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "uri is required")
		return
	}

	var track models.Track
	_ = json.NewDecoder(r.Body).Decode(&track)
	track.URI = uri
	if track.ID == "" {
		track.ID = strings.TrimPrefix(uri, "spotify:track:")
	}

	if err := h.libraryRepo.SaveTrack(r.Context(), user.ID, track); err != nil {
		writeError(w, http.StatusInternalServerError, "save_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"saved": true})
}

func (h *MusicHandler) RemoveTrack(w http.ResponseWriter, r *http.Request) {
	_, user, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	uri := strings.TrimSpace(r.URL.Query().Get("uri"))
	if uri == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "uri is required")
		return
	}
	if err := h.libraryRepo.RemoveTrack(r.Context(), user.ID, uri); err != nil {
		writeError(w, http.StatusInternalServerError, "remove_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"saved": false})
}

func (h *MusicHandler) TrackSaved(w http.ResponseWriter, r *http.Request) {
	_, user, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	uri := strings.TrimSpace(r.URL.Query().Get("uri"))
	if uri == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "uri is required")
		return
	}
	saved, err := h.libraryRepo.IsTrackSaved(r.Context(), user.ID, uri)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "check_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"saved": saved})
}

func (h *MusicHandler) GetSavedTracks(w http.ResponseWriter, r *http.Request) {
	_, user, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	tracks, err := h.libraryRepo.GetSavedTracks(r.Context(), user.ID, queryLimit(r, 50))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "fetch_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"items": tracks})
}

func (h *MusicHandler) GetPlayerToken(w http.ResponseWriter, r *http.Request) {
	token, _, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, map[string]string{"access_token": token})
}

// Playback controls (HTML5 player handles streaming in the browser; endpoints return 204)
func (h *MusicHandler) GetPlaybackState(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusNoContent)
}

func (h *MusicHandler) GetDevices(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"devices": []map[string]interface{}{
			{
				"id":         "sonara-web-device",
				"name":       "Sonara Studio Engine",
				"type":       "Computer",
				"is_active":  true,
				"volume_percent": 100,
			},
		},
	})
}

func (h *MusicHandler) Play(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusNoContent)
}

func (h *MusicHandler) Pause(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusNoContent)
}

func (h *MusicHandler) Next(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusNoContent)
}

func (h *MusicHandler) Previous(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusNoContent)
}

func (h *MusicHandler) Seek(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusNoContent)
}

func (h *MusicHandler) SetVolume(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusNoContent)
}
