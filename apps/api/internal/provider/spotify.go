package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/sonara/api/internal/models"
	"golang.org/x/sync/singleflight"
)

type cachedSearchResult struct {
	result  *models.SearchResult
	expires time.Time
}

type cachedAlbum struct {
	album   *models.AlbumDetail
	expires time.Time
}

type cachedTrack struct {
	track   *models.Track
	expires time.Time
}

// SpotifyProvider fetches public catalogue metadata using client credentials.
type SpotifyProvider struct {
	clientID      string
	clientSecret  string
	defaultMarket string
	baseURL       string
	tokenURL      string
	httpClient    *http.Client

	mu       sync.Mutex
	token    string
	tokenExp time.Time

	sf singleflight.Group

	searchMu    sync.RWMutex
	searchCache map[string]cachedSearchResult

	albumMu    sync.RWMutex
	albumCache map[string]cachedAlbum

	trackMu    sync.RWMutex
	trackCache map[string]cachedTrack
}

func NewSpotifyProvider(clientID, clientSecret, defaultMarket string) *SpotifyProvider {
	if defaultMarket == "" {
		defaultMarket = "US"
	}

	transport := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   5 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		MaxIdleConns:          100,
		MaxIdleConnsPerHost:   50,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   5 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}

	return &SpotifyProvider{
		clientID:      clientID,
		clientSecret:  clientSecret,
		defaultMarket: strings.ToUpper(defaultMarket),
		baseURL:       "https://api.spotify.com/v1",
		tokenURL:      "https://accounts.spotify.com/api/token",
		httpClient:    &http.Client{Timeout: 10 * time.Second, Transport: transport},
		searchCache:   make(map[string]cachedSearchResult),
		albumCache:    make(map[string]cachedAlbum),
		trackCache:    make(map[string]cachedTrack),
	}
}

func (s *SpotifyProvider) Name() string { return "spotify" }

// Configured reports whether catalogue credentials are present.
func (s *SpotifyProvider) Configured() bool { return s.clientID != "" && s.clientSecret != "" }

// GetAppToken returns a cached client-credentials token, refreshed shortly before it expires.
func (s *SpotifyProvider) GetAppToken(ctx context.Context) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.token != "" && time.Now().Before(s.tokenExp) {
		return s.token, nil
	}
	if !s.Configured() {
		return "", fmt.Errorf("SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET are not configured")
	}

	data := url.Values{}
	data.Set("grant_type", "client_credentials")
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.tokenURL, bytes.NewBufferString(data.Encode()))
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
		return "", errFromResponse(resp)
	}
	var res struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return "", err
	}
	s.token = res.AccessToken
	s.tokenExp = time.Now().Add(time.Duration(res.ExpiresIn-60) * time.Second)
	return s.token, nil
}

func (s *SpotifyProvider) invalidateToken() {
	s.mu.Lock()
	s.token = ""
	s.mu.Unlock()
}

// catalogGET performs a GET with the app token. It retries once on 401 (expired
// token) and backs off on 429. Any other non-200 becomes a typed APIError.
func (s *SpotifyProvider) catalogGET(ctx context.Context, endpoint string, out interface{}) error {
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		tok, err := s.GetAppToken(ctx)
		if err != nil {
			return &APIError{Status: http.StatusServiceUnavailable, Message: "spotify app token unavailable: " + err.Error()}
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.baseURL+endpoint, nil)
		if err != nil {
			return err
		}
		req.Header.Set("Authorization", "Bearer "+tok)
		resp, err := s.httpClient.Do(req)
		if err != nil {
			return err
		}
		switch resp.StatusCode {
		case http.StatusOK:
			defer resp.Body.Close()
			return json.NewDecoder(resp.Body).Decode(out)
		case http.StatusUnauthorized:
			lastErr = errFromResponse(resp)
			resp.Body.Close()
			s.invalidateToken()
		case http.StatusTooManyRequests:
			wait := 1
			if v, err := strconv.Atoi(resp.Header.Get("Retry-After")); err == nil && v > 0 && v <= 5 {
				wait = v
			}
			lastErr = errFromResponse(resp)
			resp.Body.Close()
			log.Warn().Int("retry_after", wait).Msg("Spotify rate limited, backing off")
			select {
			case <-time.After(time.Duration(wait) * time.Second):
			case <-ctx.Done():
				return ctx.Err()
			}
		default:
			e := errFromResponse(resp)
			resp.Body.Close()
			return e
		}
	}
	return lastErr
}

// GetArtist fetches one artist (batch artist fetches were removed in 2026).
func (s *SpotifyProvider) GetArtist(ctx context.Context, id string) (*models.Artist, error) {
	var a rawArtist
	if err := s.catalogGET(ctx, "/artists/"+url.PathEscape(id), &a); err != nil {
		return nil, err
	}
	return &models.Artist{ID: a.ID, Name: a.Name, URI: a.URI, Genres: a.Genres, Images: a.Images}, nil
}

// GetArtistAlbums lists an artist's albums and singles (limit is capped at 10 in Development Mode).
func (s *SpotifyProvider) GetArtistAlbums(ctx context.Context, id, market string, limit int) ([]models.AlbumSummary, error) {
	if limit <= 0 || limit > maxSearchLimit {
		limit = maxSearchLimit
	}
	var page struct {
		Items []*models.AlbumSummary `json:"items"`
	}
	endpoint := fmt.Sprintf("/artists/%s/albums?include_groups=album,single&limit=%d&market=%s",
		url.PathEscape(id), limit, url.QueryEscape(s.resolveMarket(market)))
	if err := s.catalogGET(ctx, endpoint, &page); err != nil {
		return nil, err
	}
	out := make([]models.AlbumSummary, 0, len(page.Items))
	for _, a := range page.Items {
		if a != nil && a.ID != "" {
			out = append(out, *a)
		}
	}
	return out, nil
}

// GetTrack fetches one track (cached in memory for 1 hour).
func (s *SpotifyProvider) GetTrack(ctx context.Context, id string) (*models.Track, error) {
	id = strings.TrimPrefix(id, "spotify:track:")
	if id == "" {
		return nil, fmt.Errorf("track id is required")
	}

	s.trackMu.RLock()
	if c, ok := s.trackCache[id]; ok && time.Now().Before(c.expires) {
		s.trackMu.RUnlock()
		return c.track, nil
	}
	s.trackMu.RUnlock()

	v, err, _ := s.sf.Do("track:"+id, func() (interface{}, error) {
		// Shared by every waiting caller: one caller hanging up must not fail the rest.
		ctx := context.WithoutCancel(ctx)
		var t rawTrack
		if err := s.catalogGET(ctx, "/tracks/"+url.PathEscape(id), &t); err != nil {
			return nil, err
		}
		res := &models.Track{
			ID: t.ID, Name: t.Name, URI: t.URI, PreviewURL: t.PreviewURL, DurationMs: t.DurationMs,
			Explicit: t.Explicit, Artists: t.Artists, Album: t.Album,
		}
		s.trackMu.Lock()
		if len(s.trackCache) > 3000 {
			s.trackCache = make(map[string]cachedTrack)
		}
		s.trackCache[id] = cachedTrack{track: res, expires: time.Now().Add(1 * time.Hour)}
		s.trackMu.Unlock()
		return res, nil
	})
	if err != nil {
		return nil, err
	}
	return v.(*models.Track), nil
}

// GetAlbum fetches an album with its tracks (cached in memory for 1 hour).
func (s *SpotifyProvider) GetAlbum(ctx context.Context, id, market string) (*models.AlbumDetail, error) {
	resolvedMarket := s.resolveMarket(market)
	cacheKey := fmt.Sprintf("%s:%s", id, resolvedMarket)

	s.albumMu.RLock()
	if c, ok := s.albumCache[cacheKey]; ok && time.Now().Before(c.expires) {
		s.albumMu.RUnlock()
		return c.album, nil
	}
	s.albumMu.RUnlock()

	v, err, _ := s.sf.Do("album:"+cacheKey, func() (interface{}, error) {
		ctx := context.WithoutCancel(ctx)
		var raw struct {
			models.AlbumSummary
			Artists []models.ArtistSummary `json:"artists"`
			Label   string                 `json:"label"`
			Total   int                    `json:"total_tracks"`
			Tracks  struct {
				Items []*rawTrack `json:"items"`
			} `json:"tracks"`
		}
		endpoint := fmt.Sprintf("/albums/%s?market=%s", url.PathEscape(id), url.QueryEscape(resolvedMarket))
		if err := s.catalogGET(ctx, endpoint, &raw); err != nil {
			return nil, err
		}
		detail := &models.AlbumDetail{Album: raw.AlbumSummary, Artists: raw.Artists, Label: raw.Label, TotalTracks: raw.Total}
		for _, t := range raw.Tracks.Items {
			if t == nil || t.ID == "" {
				continue
			}
			detail.Tracks = append(detail.Tracks, models.Track{
				ID: t.ID, Name: t.Name, URI: t.URI, PreviewURL: t.PreviewURL,
				DurationMs: t.DurationMs, Explicit: t.Explicit, Artists: t.Artists, Album: raw.AlbumSummary,
			})
		}
		s.albumMu.Lock()
		if len(s.albumCache) > 1000 {
			s.albumCache = make(map[string]cachedAlbum)
		}
		s.albumCache[cacheKey] = cachedAlbum{album: detail, expires: time.Now().Add(1 * time.Hour)}
		s.albumMu.Unlock()
		return detail, nil
	})
	if err != nil {
		return nil, err
	}
	return v.(*models.AlbumDetail), nil
}
