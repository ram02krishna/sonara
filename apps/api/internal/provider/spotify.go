package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/sonara/api/internal/models"
)

type SpotifyProvider struct {
	clientID     string
	clientSecret string
	httpClient   *http.Client
}

func NewSpotifyProvider(clientID, clientSecret string) *SpotifyProvider {
	return &SpotifyProvider{
		clientID:     clientID,
		clientSecret: clientSecret,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (s *SpotifyProvider) Name() string { return "spotify" }

// doRequest performs an HTTP request to Spotify API with backoff retry on 429 and error classification
func (s *SpotifyProvider) doRequest(ctx context.Context, method, endpoint, token string, body io.Reader) (*http.Response, error) {
	apiURL := "https://api.spotify.com/v1" + endpoint
	maxRetries := 3

	for attempt := 0; attempt < maxRetries; attempt++ {
		req, err := http.NewRequestWithContext(ctx, method, apiURL, body)
		if err != nil {
			return nil, err
		}

		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")

		resp, err := s.httpClient.Do(req)
		if err != nil {
			return nil, err
		}

		if resp.StatusCode == http.StatusTooManyRequests {
			// Handle 429 Rate Limit
			retryAfterSec := 1
			if h := resp.Header.Get("Retry-After"); h != "" {
				if parsed, err := strconv.Atoi(h); err == nil && parsed > 0 {
					retryAfterSec = parsed
				}
			}
			resp.Body.Close()
			log.Warn().Int("retry_after", retryAfterSec).Msg("Spotify 429 rate limited, backing off")
			select {
			case <-time.After(time.Duration(retryAfterSec) * time.Second):
				continue
			case <-ctx.Done():
				return nil, ctx.Err()
			}
		}

		if resp.StatusCode == http.StatusForbidden {
			// 403 Forbidden: 2026 Developer mode restriction or Non-Premium user restriction
			return resp, fmt.Errorf("spotify 403 forbidden: ensure user is in allowlist or has active Spotify Premium")
		}

		return resp, nil
	}

	return nil, fmt.Errorf("spotify request failed after %d retries", maxRetries)
}

func (s *SpotifyProvider) GetProfile(ctx context.Context, accessToken string) (*models.User, error) {
	resp, err := s.doRequest(ctx, http.MethodGet, "/me", accessToken, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get profile: status %d", resp.StatusCode)
	}

	var data struct {
		ID          string `json:"id"`
		DisplayName string `json:"display_name"`
		Email       string `json:"email"`
		Product     string `json:"product"`
		Country     string `json:"country"`
		Images      []struct {
			URL string `json:"url"`
		} `json:"images"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}

	avatar := ""
	if len(data.Images) > 0 {
		avatar = data.Images[0].URL
	}

	return &models.User{
		SpotifyID:   data.ID,
		DisplayName: data.DisplayName,
		Email:       data.Email,
		Product:     data.Product,
		Country:     data.Country,
		AvatarURL:   avatar,
	}, nil
}

func (s *SpotifyProvider) GetTopArtists(ctx context.Context, accessToken string, timeRange string, limit int) ([]models.Artist, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	endpoint := fmt.Sprintf("/me/top/artists?time_range=%s&limit=%d", timeRange, limit)
	resp, err := s.doRequest(ctx, http.MethodGet, endpoint, accessToken, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var data struct {
		Items []struct {
			ID        string   `json:"id"`
			Name      string   `json:"name"`
			URI       string   `json:"uri"`
			Genres    []string `json:"genres"`
			Followers struct {
				Total int `json:"total"`
			} `json:"followers"`
			Popularity int `json:"popularity"`
			Images     []models.Image `json:"images"`
		} `json:"items"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}

	artists := make([]models.Artist, 0, len(data.Items))
	for _, item := range data.Items {
		artists = append(artists, models.Artist{
			ID:         item.ID,
			Name:       item.Name,
			URI:        item.URI,
			Genres:     item.Genres,
			Followers:  item.Followers.Total,
			Popularity: item.Popularity,
			Images:     item.Images,
		})
	}

	return artists, nil
}

func (s *SpotifyProvider) GetTopTracks(ctx context.Context, accessToken string, timeRange string, limit int) ([]models.Track, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	endpoint := fmt.Sprintf("/me/top/tracks?time_range=%s&limit=%d", timeRange, limit)
	resp, err := s.doRequest(ctx, http.MethodGet, endpoint, accessToken, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var data struct {
		Items []struct {
			ID         string `json:"id"`
			Name       string `json:"name"`
			URI        string `json:"uri"`
			DurationMs int    `json:"duration_ms"`
			Popularity int    `json:"popularity"`
			Artists    []models.ArtistSummary `json:"artists"`
			Album      models.AlbumSummary    `json:"album"`
		} `json:"items"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}

	tracks := make([]models.Track, 0, len(data.Items))
	for _, item := range data.Items {
		tracks = append(tracks, models.Track{
			ID:         item.ID,
			Name:       item.Name,
			URI:        item.URI,
			DurationMs: item.DurationMs,
			Popularity: item.Popularity,
			Artists:    item.Artists,
			Album:      item.Album,
		})
	}

	return tracks, nil
}

func (s *SpotifyProvider) GetRecentlyPlayed(ctx context.Context, accessToken string, limit int) ([]models.PlayHistoryItem, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	endpoint := fmt.Sprintf("/me/player/recently-played?limit=%d", limit)
	resp, err := s.doRequest(ctx, http.MethodGet, endpoint, accessToken, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var data struct {
		Items []struct {
			Track    models.Track `json:"track"`
			PlayedAt time.Time    `json:"played_at"`
		} `json:"items"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}

	items := make([]models.PlayHistoryItem, 0, len(data.Items))
	for _, item := range data.Items {
		items = append(items, models.PlayHistoryItem{
			Track:    item.Track,
			PlayedAt: item.PlayedAt,
		})
	}
	return items, nil
}

func (s *SpotifyProvider) Search(ctx context.Context, accessToken string, query string, types string, limit int) (*models.SearchResult, error) {
	// Spotify 2026 Developer restriction: search is capped at 10 results
	if limit > 10 {
		limit = 10
	}
	if limit <= 0 {
		limit = 10
	}
	if types == "" {
		types = "track,artist,album,playlist"
	}

	endpoint := fmt.Sprintf("/search?q=%s&type=%s&limit=%d", url.QueryEscape(query), types, limit)
	resp, err := s.doRequest(ctx, http.MethodGet, endpoint, accessToken, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var data struct {
		Tracks struct {
			Items []models.Track `json:"items"`
		} `json:"tracks"`
		Artists struct {
			Items []models.Artist `json:"items"`
		} `json:"artists"`
		Albums struct {
			Items []models.AlbumSummary `json:"items"`
		} `json:"albums"`
		Playlists struct {
			Items []models.PlaylistSummary `json:"items"`
		} `json:"playlists"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}

	return &models.SearchResult{
		Tracks:    data.Tracks.Items,
		Artists:   data.Artists.Items,
		Albums:    data.Albums.Items,
		Playlists: data.Playlists.Items,
	}, nil
}

func (s *SpotifyProvider) GetPlaybackState(ctx context.Context, accessToken string) (*models.PlaybackState, error) {
	resp, err := s.doRequest(ctx, http.MethodGet, "/me/player", accessToken, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNoContent {
		return nil, nil
	}

	var state models.PlaybackState
	if err := json.NewDecoder(resp.Body).Decode(&state); err != nil {
		return nil, err
	}
	return &state, nil
}

func (s *SpotifyProvider) GetDevices(ctx context.Context, accessToken string) ([]models.Device, error) {
	resp, err := s.doRequest(ctx, http.MethodGet, "/me/player/devices", accessToken, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var data struct {
		Devices []models.Device `json:"devices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}
	return data.Devices, nil
}

func (s *SpotifyProvider) TransferPlayback(ctx context.Context, accessToken string, deviceIDs []string, play bool) error {
	payload := map[string]interface{}{
		"device_ids": deviceIDs,
		"play":       play,
	}
	body, _ := json.Marshal(payload)
	resp, err := s.doRequest(ctx, http.MethodPut, "/me/player", accessToken, bytes.NewReader(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

func (s *SpotifyProvider) Play(ctx context.Context, accessToken string, deviceID string, body map[string]interface{}) error {
	endpoint := "/me/player/play"
	if deviceID != "" {
		endpoint += "?device_id=" + deviceID
	}
	var reader io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		reader = bytes.NewReader(b)
	}
	resp, err := s.doRequest(ctx, http.MethodPut, endpoint, accessToken, reader)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

func (s *SpotifyProvider) Pause(ctx context.Context, accessToken string, deviceID string) error {
	endpoint := "/me/player/pause"
	if deviceID != "" {
		endpoint += "?device_id=" + deviceID
	}
	resp, err := s.doRequest(ctx, http.MethodPut, endpoint, accessToken, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

func (s *SpotifyProvider) Next(ctx context.Context, accessToken string, deviceID string) error {
	endpoint := "/me/player/next"
	if deviceID != "" {
		endpoint += "?device_id=" + deviceID
	}
	resp, err := s.doRequest(ctx, http.MethodPost, endpoint, accessToken, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

func (s *SpotifyProvider) Previous(ctx context.Context, accessToken string, deviceID string) error {
	endpoint := "/me/player/previous"
	if deviceID != "" {
		endpoint += "?device_id=" + deviceID
	}
	resp, err := s.doRequest(ctx, http.MethodPost, endpoint, accessToken, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

func (s *SpotifyProvider) Seek(ctx context.Context, accessToken string, positionMs int) error {
	endpoint := fmt.Sprintf("/me/player/seek?position_ms=%d", positionMs)
	resp, err := s.doRequest(ctx, http.MethodPut, endpoint, accessToken, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

func (s *SpotifyProvider) SetVolume(ctx context.Context, accessToken string, volumePercent int) error {
	endpoint := fmt.Sprintf("/me/player/volume?volume_percent=%d", volumePercent)
	resp, err := s.doRequest(ctx, http.MethodPut, endpoint, accessToken, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}
