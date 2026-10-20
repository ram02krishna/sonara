package provider

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/rs/zerolog/log"
	"github.com/sonara/api/internal/models"
)

const maxSearchLimit = 10

type rawTrack struct {
	ID         string                 `json:"id"`
	Name       string                 `json:"name"`
	URI        string                 `json:"uri"`
	PreviewURL *string                `json:"preview_url"`
	DurationMs int                    `json:"duration_ms"`
	Explicit   bool                   `json:"explicit"`
	Artists    []models.ArtistSummary `json:"artists"`
	Album      models.AlbumSummary    `json:"album"`
}

type rawArtist struct {
	ID     string         `json:"id"`
	Name   string         `json:"name"`
	URI    string         `json:"uri"`
	Genres []string       `json:"genres"`
	Images []models.Image `json:"images"`
}

type rawPlaylist struct {
	ID          string         `json:"id"`
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Images      []models.Image `json:"images"`
	Owner       struct {
		DisplayName string `json:"display_name"`
	} `json:"owner"`
	// Spotify renamed playlist "tracks" to "items" in Feb 2026; accept both.
	Tracks *struct {
		Total int `json:"total"`
	} `json:"tracks"`
	Items *struct {
		Total int `json:"total"`
	} `json:"items"`
}

type rawSearchResponse struct {
	Tracks *struct {
		Items []*rawTrack `json:"items"`
	} `json:"tracks"`
	Artists *struct {
		Items []*rawArtist `json:"items"`
	} `json:"artists"`
	Albums *struct {
		Items []*models.AlbumSummary `json:"items"`
	} `json:"albums"`
	Playlists *struct {
		Items []*rawPlaylist `json:"items"` // Spotify can return null entries here
	} `json:"playlists"`
}

// resolveMarket returns the `market` query value. A logged-in user's token can
// resolve their own country ("from_token"); app-only tokens need an ISO code.
func (s *SpotifyProvider) resolveMarket(userToken bool, market string) string {
	market = strings.ToUpper(strings.TrimSpace(market))
	if market == "FROM_TOKEN" {
		market = "from_token"
	}
	if userToken {
		if market == "" {
			return "from_token"
		}
		return market
	}
	if market == "" || market == "from_token" {
		if s.defaultMarket != "" {
			return s.defaultMarket
		}
		return "US"
	}
	return market
}

// Search queries Spotify (never a third-party catalog). If accessToken is empty
// or is an app token, the app's client-credentials token is used with defaultMarket.
func (s *SpotifyProvider) Search(ctx context.Context, accessToken, query, types string, limit int, market string) (*models.SearchResult, error) {
	if strings.TrimSpace(query) == "" {
		return &models.SearchResult{}, nil
	}
	if limit <= 0 || limit > maxSearchLimit {
		limit = maxSearchLimit
	}
	if types == "" {
		types = "track,artist,album,playlist"
	}

	s.tokenMu.RLock()
	cached := s.cachedToken
	s.tokenMu.RUnlock()

	// Client credentials app tokens cannot use market=from_token (Spotify returns 403).
	userToken := accessToken != "" && accessToken != cached
	if accessToken == "" || accessToken == cached {
		appToken, err := s.GetAppToken(ctx)
		if err != nil {
			log.Warn().Err(err).Msg("failed to get Spotify app token for search, falling back to open catalog")
			return s.searchOpenCatalog(ctx, query, limit)
		}
		accessToken = appToken
	}

	resolvedMarket := s.resolveMarket(userToken, market)
	endpoint := fmt.Sprintf("/search?q=%s&type=%s&limit=%d&market=%s",
		url.QueryEscape(query), url.QueryEscape(types), limit, url.QueryEscape(resolvedMarket))
	resp, err := s.doRequest(ctx, http.MethodGet, endpoint, accessToken, nil)
	if err != nil {
		log.Warn().Err(err).Str("query", query).Msg("Spotify search request failed, falling back to open catalog")
		return s.searchOpenCatalog(ctx, query, limit)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		log.Warn().Int("status", resp.StatusCode).Str("body", string(bodyBytes)).Str("query", query).Msg("Spotify search returned non-200, falling back to open catalog")
		return s.searchOpenCatalog(ctx, query, limit)
	}

	var raw rawSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, err
	}

	out := &models.SearchResult{}
	if raw.Tracks != nil {
		for _, t := range raw.Tracks.Items {
			if t == nil || t.ID == "" {
				continue
			}
			out.Tracks = append(out.Tracks, models.Track{
				ID: t.ID, Name: t.Name, URI: t.URI, PreviewURL: t.PreviewURL,
				DurationMs: t.DurationMs, Explicit: t.Explicit, Artists: t.Artists, Album: t.Album,
			})
		}
	}
	if raw.Artists != nil {
		for _, a := range raw.Artists.Items {
			if a == nil || a.ID == "" {
				continue
			}
			out.Artists = append(out.Artists, models.Artist{ID: a.ID, Name: a.Name, URI: a.URI, Genres: a.Genres, Images: a.Images})
		}
	}
	if raw.Albums != nil {
		for _, a := range raw.Albums.Items {
			if a == nil || a.ID == "" {
				continue
			}
			out.Albums = append(out.Albums, *a)
		}
	}
	if raw.Playlists != nil {
		for _, p := range raw.Playlists.Items {
			if p == nil || p.ID == "" {
				continue
			}
			total := 0
			if p.Items != nil {
				total = p.Items.Total
			} else if p.Tracks != nil {
				total = p.Tracks.Total
			}
			out.Playlists = append(out.Playlists, models.PlaylistSummary{
				ID: p.ID, Name: p.Name, Description: p.Description, Images: p.Images,
				OwnerName: p.Owner.DisplayName, TracksTotal: total,
			})
		}
	}
	return out, nil
}

// SearchNewAlbums replaces the removed GET /browse/new-releases endpoint
// (unavailable to Development Mode apps) using Spotify's `tag:new` search filter.
func (s *SpotifyProvider) SearchNewAlbums(ctx context.Context, accessToken, market string, limit int) ([]models.AlbumSummary, error) {
	res, err := s.Search(ctx, accessToken, "tag:new", "album", limit, market)
	if err != nil {
		return nil, err
	}
	return res.Albums, nil
}

func (s *SpotifyProvider) searchOpenCatalog(ctx context.Context, query string, limit int) (*models.SearchResult, error) {
	if limit <= 0 || limit > 30 {
		limit = 20
	}
	apiURL := fmt.Sprintf("https://itunes.apple.com/search?term=%s&media=music&entity=song&limit=%d", url.QueryEscape(query), limit)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return &models.SearchResult{}, nil
	}
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return &models.SearchResult{}, nil
	}
	defer resp.Body.Close()

	var data struct {
		Results []struct {
			TrackID    int    `json:"trackId"`
			TrackName  string `json:"trackName"`
			ArtistName string `json:"artistName"`
			AlbumName  string `json:"collectionName"`
			ArtURL     string `json:"artworkUrl100"`
			PreviewURL string `json:"previewUrl"`
			DurationMs int    `json:"trackTimeMillis"`
		} `json:"results"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return &models.SearchResult{}, nil
	}

	out := &models.SearchResult{
		Tracks: make([]models.Track, 0, len(data.Results)),
	}
	for _, it := range data.Results {
		if it.TrackName == "" {
			continue
		}
		id := strconv.Itoa(it.TrackID)
		art600 := strings.Replace(it.ArtURL, "100x100bb", "600x600bb", 1)
		pURL := it.PreviewURL
		out.Tracks = append(out.Tracks, models.Track{
			ID:         id,
			Name:       it.TrackName,
			URI:        "spotify:track:" + id,
			DurationMs: it.DurationMs,
			PreviewURL: &pURL,
			Artists:    []models.ArtistSummary{{Name: it.ArtistName}},
			Album: models.AlbumSummary{
				Name:   it.AlbumName,
				Images: []models.Image{{URL: art600}},
			},
		})
	}
	return out, nil
}

func (s *SpotifyProvider) GetTrack(ctx context.Context, accessToken string, id string) (*models.Track, error) {
	if id == "" {
		return nil, fmt.Errorf("track id is required")
	}
	id = strings.TrimPrefix(id, "spotify:track:")
	if accessToken == "" {
		var err error
		accessToken, err = s.GetAppToken(ctx)
		if err != nil {
			return nil, err
		}
	}
	resp, err := s.doRequest(ctx, http.MethodGet, "/tracks/"+url.PathEscape(id), accessToken, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, errFromResponse(resp)
	}
	var t rawTrack
	if err := json.NewDecoder(resp.Body).Decode(&t); err != nil {
		return nil, err
	}
	return &models.Track{
		ID:         t.ID,
		Name:       t.Name,
		URI:        t.URI,
		PreviewURL: t.PreviewURL,
		DurationMs: t.DurationMs,
		Explicit:   t.Explicit,
		Artists:    t.Artists,
		Album:      t.Album,
	}, nil
}
