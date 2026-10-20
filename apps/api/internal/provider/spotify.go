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
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/sonara/api/internal/models"
)

type SpotifyProvider struct {
	clientID      string
	clientSecret  string
	defaultMarket string // ISO market used for logged-out (app token) catalog requests
	baseURL       string // Spotify Web API base (overridable in tests)
	httpClient    *http.Client

	tokenMu     sync.RWMutex
	cachedToken string
	tokenExpiry time.Time
}

func NewSpotifyProvider(clientID, clientSecret, defaultMarket string) *SpotifyProvider {
	if defaultMarket == "" {
		defaultMarket = "US"
	}
	return &SpotifyProvider{
		clientID:      strings.TrimSpace(clientID),
		clientSecret:  strings.TrimSpace(clientSecret),
		defaultMarket: strings.ToUpper(strings.TrimSpace(defaultMarket)),
		baseURL:       "https://api.spotify.com/v1",
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (s *SpotifyProvider) Name() string { return "spotify" }

// doRequest performs an HTTP request to Spotify API with backoff retry on 429 and error classification
func (s *SpotifyProvider) doRequest(ctx context.Context, method, endpoint, token string, body io.Reader) (*http.Response, error) {
	apiURL := s.baseURL + endpoint
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

		if resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusUnauthorized {
			// 401/403: expired token, Development Mode restriction, allowlist or Premium requirement
			apiErr := errFromResponse(resp)
			resp.Body.Close()
			return nil, apiErr
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
	if resp.StatusCode != http.StatusOK {
		return nil, errFromResponse(resp)
	}

	var data struct {
		Items []struct {
			ID        string   `json:"id"`
			Name      string   `json:"name"`
			URI       string   `json:"uri"`
			Genres    []string `json:"genres"`
			Followers struct {
				Total int `json:"total"`
			} `json:"followers"`
			Popularity int            `json:"popularity"`
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
	if resp.StatusCode != http.StatusOK {
		return nil, errFromResponse(resp)
	}

	var data struct {
		Items []struct {
			ID         string                 `json:"id"`
			Name       string                 `json:"name"`
			URI        string                 `json:"uri"`
			DurationMs int                    `json:"duration_ms"`
			Popularity int                    `json:"popularity"`
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
	if resp.StatusCode != http.StatusOK {
		return nil, errFromResponse(resp)
	}

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

// GetAppToken obtains a Spotify Client Credentials token for catalog search with thread-safe in-memory caching
func (s *SpotifyProvider) GetAppToken(ctx context.Context) (string, error) {
	s.tokenMu.RLock()
	if s.cachedToken != "" && time.Now().Before(s.tokenExpiry) {
		token := s.cachedToken
		s.tokenMu.RUnlock()
		return token, nil
	}
	s.tokenMu.RUnlock()

	s.tokenMu.Lock()
	defer s.tokenMu.Unlock()
	if s.cachedToken != "" && time.Now().Before(s.tokenExpiry) {
		return s.cachedToken, nil
	}

	data := url.Values{}
	data.Set("grant_type", "client_credentials")

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://accounts.spotify.com/api/token", bytes.NewBufferString(data.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.SetBasicAuth(s.clientID, s.clientSecret)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("spotify client_credentials token request returned %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var res struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return "", err
	}

	ttl := time.Duration(res.ExpiresIn-60) * time.Second
	if ttl <= 0 {
		ttl = 3000 * time.Second
	}
	s.cachedToken = res.AccessToken
	s.tokenExpiry = time.Now().Add(ttl)

	return res.AccessToken, nil
}

func intPtr(i int) *int {
	return &i
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
	if resp.StatusCode != http.StatusOK {
		return nil, errFromResponse(resp)
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
	if resp.StatusCode != http.StatusOK {
		return nil, errFromResponse(resp)
	}

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
	if resp.StatusCode >= 300 {
		return errFromResponse(resp)
	}
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
	if resp.StatusCode >= 300 {
		return errFromResponse(resp)
	}
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
	if resp.StatusCode >= 300 {
		return errFromResponse(resp)
	}
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
	if resp.StatusCode >= 300 {
		return errFromResponse(resp)
	}
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
	if resp.StatusCode >= 300 {
		return errFromResponse(resp)
	}
	return nil
}

func (s *SpotifyProvider) Seek(ctx context.Context, accessToken string, positionMs int) error {
	endpoint := fmt.Sprintf("/me/player/seek?position_ms=%d", positionMs)
	resp, err := s.doRequest(ctx, http.MethodPut, endpoint, accessToken, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return errFromResponse(resp)
	}
	return nil
}

func (s *SpotifyProvider) SetVolume(ctx context.Context, accessToken string, volumePercent int) error {
	endpoint := fmt.Sprintf("/me/player/volume?volume_percent=%d", volumePercent)
	resp, err := s.doRequest(ctx, http.MethodPut, endpoint, accessToken, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return errFromResponse(resp)
	}
	return nil
}
