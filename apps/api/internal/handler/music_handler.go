package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"github.com/sonara/api/internal/models"
	"github.com/sonara/api/internal/provider"
	"github.com/sonara/api/internal/repository"
	"github.com/sonara/api/internal/service"
)

type MusicHandler struct {
	userRepo    *repository.UserRepository
	authService *service.AuthService
	provider    provider.MusicProvider
}

func NewMusicHandler(
	userRepo *repository.UserRepository,
	authService *service.AuthService,
	provider provider.MusicProvider,
) *MusicHandler {
	return &MusicHandler{
		userRepo:    userRepo,
		authService: authService,
		provider:    provider,
	}
}

// resolveToken resolves the active access token for the session or returns error
func (h *MusicHandler) resolveToken(r *http.Request) (string, *models.User, error) {
	cookie, err := r.Cookie("sonara_session")
	if err != nil || cookie.Value == "" {
		return "", nil, http.ErrNoCookie
	}

	user, err := h.userRepo.GetUserBySession(r.Context(), cookie.Value)
	if err != nil || user == nil {
		return "", nil, http.ErrNoCookie
	}

	token, err := h.authService.GetValidAccessToken(r.Context(), user)
	if err != nil {
		return "", nil, err
	}

	return token, user, nil
}

func (h *MusicHandler) GetMe(w http.ResponseWriter, r *http.Request) {
	token, user, err := h.resolveToken(r)
	if err != nil {
		// Demo fallback profile
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(models.User{
			SpotifyID:   "sonara_demo_user",
			DisplayName: "Audiophile",
			Email:       "audiophile@sonara.app",
			Product:     "premium",
			Country:     "US",
		})
		return
	}

	profile, err := h.provider.GetProfile(r.Context(), token)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(user)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(profile)
}

func (h *MusicHandler) GetTopArtists(w http.ResponseWriter, r *http.Request) {
	token, _, _ := h.resolveToken(r)
	timeRange := r.URL.Query().Get("time_range")
	if timeRange == "" {
		timeRange = "medium_term"
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 {
		limit = 20
	}

	if token != "" {
		artists, err := h.provider.GetTopArtists(r.Context(), token, timeRange, limit)
		if err == nil && len(artists) > 0 {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"items": artists})
			return
		}
	}

	// Demo fallback
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"items": []models.Artist{
			{
				ID: "artist-the-weeknd", Name: "The Weeknd", Genres: []string{"canadian contemporary r&b", "pop"},
				Images: []models.Image{{URL: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600"}},
			},
			{
				ID: "artist-daft-punk", Name: "Daft Punk", Genres: []string{"electro", "french house"},
				Images: []models.Image{{URL: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600"}},
			},
		},
	})
}

func (h *MusicHandler) GetTopTracks(w http.ResponseWriter, r *http.Request) {
	token, _, _ := h.resolveToken(r)
	timeRange := r.URL.Query().Get("time_range")
	if timeRange == "" {
		timeRange = "medium_term"
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 {
		limit = 20
	}

	if token != "" {
		tracks, err := h.provider.GetTopTracks(r.Context(), token, timeRange, limit)
		if err == nil && len(tracks) > 0 {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"items": tracks})
			return
		}
	}

	// Demo fallback
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"items": []models.Track{
			{
				ID: "track-1", Name: "Starboy", DurationMs: 230453,
				Artists: []models.ArtistSummary{{ID: "artist-the-weeknd", Name: "The Weeknd"}},
				Album:   models.AlbumSummary{ID: "album-starboy", Name: "Starboy", Images: []models.Image{{URL: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600"}}},
			},
		},
	})
}

func (h *MusicHandler) GetRecentlyPlayed(w http.ResponseWriter, r *http.Request) {
	token, _, _ := h.resolveToken(r)
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 {
		limit = 20
	}

	if token != "" {
		items, err := h.provider.GetRecentlyPlayed(r.Context(), token, limit)
		if err == nil {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"items": items})
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"items": []models.PlayHistoryItem{}})
}

func (h *MusicHandler) Search(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	types := r.URL.Query().Get("type")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	token, _, _ := h.resolveToken(r)

	if token != "" && q != "" {
		res, err := h.provider.Search(r.Context(), token, q, types, limit)
		if err == nil {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(res)
			return
		}
	}

	// Demo fallback
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(models.SearchResult{
		Tracks: []models.Track{
			{
				ID: "track-1", Name: "Starboy", DurationMs: 230453,
				Artists: []models.ArtistSummary{{ID: "artist-the-weeknd", Name: "The Weeknd"}},
				Album:   models.AlbumSummary{ID: "album-starboy", Name: "Starboy", Images: []models.Image{{URL: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600"}}},
			},
		},
	})
}

func (h *MusicHandler) GetPlaybackState(w http.ResponseWriter, r *http.Request) {
	token, _, _ := h.resolveToken(r)
	if token != "" {
		state, err := h.provider.GetPlaybackState(r.Context(), token)
		if err == nil && state != nil {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(state)
			return
		}
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *MusicHandler) GetDevices(w http.ResponseWriter, r *http.Request) {
	token, _, _ := h.resolveToken(r)
	if token != "" {
		devices, err := h.provider.GetDevices(r.Context(), token)
		if err == nil {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"devices": devices})
			return
		}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"devices": []models.Device{
			{ID: "web-device-1", Name: "Sonara Web Player (Lossless)", Type: "Computer", IsActive: true, VolumePercent: 75},
		},
	})
}

func (h *MusicHandler) Play(w http.ResponseWriter, r *http.Request) {
	token, _, err := h.resolveToken(r)
	if err != nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	deviceID := r.URL.Query().Get("device_id")
	var body map[string]interface{}
	_ = json.NewDecoder(r.Body).Decode(&body)
	_ = h.provider.Play(r.Context(), token, deviceID, body)
	w.WriteHeader(http.StatusNoContent)
}

func (h *MusicHandler) Pause(w http.ResponseWriter, r *http.Request) {
	token, _, err := h.resolveToken(r)
	if err != nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	deviceID := r.URL.Query().Get("device_id")
	_ = h.provider.Pause(r.Context(), token, deviceID)
	w.WriteHeader(http.StatusNoContent)
}

func (h *MusicHandler) Next(w http.ResponseWriter, r *http.Request) {
	token, _, err := h.resolveToken(r)
	if err != nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	deviceID := r.URL.Query().Get("device_id")
	_ = h.provider.Next(r.Context(), token, deviceID)
	w.WriteHeader(http.StatusNoContent)
}

func (h *MusicHandler) Previous(w http.ResponseWriter, r *http.Request) {
	token, _, err := h.resolveToken(r)
	if err != nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	deviceID := r.URL.Query().Get("device_id")
	_ = h.provider.Previous(r.Context(), token, deviceID)
	w.WriteHeader(http.StatusNoContent)
}

func (h *MusicHandler) Seek(w http.ResponseWriter, r *http.Request) {
	token, _, err := h.resolveToken(r)
	if err != nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	posMs, _ := strconv.Atoi(r.URL.Query().Get("position_ms"))
	_ = h.provider.Seek(r.Context(), token, posMs)
	w.WriteHeader(http.StatusNoContent)
}

func (h *MusicHandler) SetVolume(w http.ResponseWriter, r *http.Request) {
	token, _, err := h.resolveToken(r)
	if err != nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	vol, _ := strconv.Atoi(r.URL.Query().Get("volume_percent"))
	_ = h.provider.SetVolume(r.Context(), token, vol)
	w.WriteHeader(http.StatusNoContent)
}
