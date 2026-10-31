package provider

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/sonara/api/internal/models"
)

// Spotify Development Mode caps search at 10 results per request and removed
// artist "followers"/"popularity". The raw structs only decode fields that still
// exist, so a missing field can never break a whole response.
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
}

// resolveMarket returns the ISO market to use (the caller's region, else the default).
func (s *SpotifyProvider) resolveMarket(market string) string {
	market = strings.ToUpper(strings.TrimSpace(market))
	if len(market) != 2 {
		return s.defaultMarket
	}
	return market
}

// Search queries the Spotify catalogue. If Spotify is unreachable or refuses the
// request, track searches fall back to Apple's public iTunes Search API so Sonara
// still has something to show; fallback tracks use "itunes:track:<id>" URIs so
// they're never mistaken for Spotify items.
// Search queries the Spotify catalogue with in-memory caching and singleflight request deduplication.
func (s *SpotifyProvider) Search(ctx context.Context, query, types string, limit, offset int, market string) (*models.SearchResult, error) {
	if strings.TrimSpace(query) == "" {
		return &models.SearchResult{}, nil
	}
	if limit <= 0 || limit > maxSearchLimit {
		limit = maxSearchLimit
	}
	if offset < 0 || offset > 990 {
		offset = 0
	}
	if types == "" {
		types = "track,artist,album"
	}

	resolvedMarket := s.resolveMarket(market)
	cacheKey := fmt.Sprintf("%s|%s|%d|%d|%s", query, types, limit, offset, resolvedMarket)

	s.searchMu.RLock()
	if c, ok := s.searchCache[cacheKey]; ok && time.Now().Before(c.expires) {
		s.searchMu.RUnlock()
		return c.result, nil
	}
	s.searchMu.RUnlock()

	v, err, _ := s.sf.Do(cacheKey, func() (interface{}, error) {
		// Shared by every waiting caller: one caller hanging up must not fail the rest.
		ctx := context.WithoutCancel(ctx)
		endpoint := fmt.Sprintf("/search?q=%s&type=%s&limit=%d&offset=%d&market=%s",
			url.QueryEscape(query), url.QueryEscape(types), limit, offset, url.QueryEscape(resolvedMarket))
		var raw rawSearchResponse
		if err := s.catalogGET(ctx, endpoint, &raw); err != nil {
			if strings.Contains(types, "track") {
				log.Warn().Err(err).Str("query", query).Msg("Spotify search failed; falling back to iTunes catalogue")
				if res, ferr := s.searchITunes(ctx, query, limit); ferr == nil && len(res.Tracks) > 0 {
					return res, nil
				}
			}
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
				if a != nil && a.ID != "" {
					out.Albums = append(out.Albums, *a)
				}
			}
		}

		s.searchMu.Lock()
		if len(s.searchCache) > 3000 {
			s.searchCache = make(map[string]cachedSearchResult)
		}
		s.searchCache[cacheKey] = cachedSearchResult{result: out, expires: time.Now().Add(15 * time.Minute)}
		s.searchMu.Unlock()

		return out, nil
	})

	if err != nil {
		return nil, err
	}
	return v.(*models.SearchResult), nil
}

// SearchNewAlbums replaces the removed GET /browse/new-releases endpoint using the `tag:new` filter.
func (s *SpotifyProvider) SearchNewAlbums(ctx context.Context, market string, limit int) ([]models.AlbumSummary, error) {
	res, err := s.Search(ctx, "tag:new", "album", limit, 0, market)
	if err != nil {
		return nil, err
	}
	return res.Albums, nil
}

func (s *SpotifyProvider) searchITunes(ctx context.Context, query string, limit int) (*models.SearchResult, error) {
	apiURL := fmt.Sprintf("https://itunes.apple.com/search?term=%s&media=music&entity=song&limit=%d", url.QueryEscape(query), limit)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return nil, err
	}
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("itunes search returned %d", resp.StatusCode)
	}
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
		return nil, err
	}
	out := &models.SearchResult{}
	for _, it := range data.Results {
		if it.TrackName == "" {
			continue
		}
		id := strconv.Itoa(it.TrackID)
		p := it.PreviewURL
		out.Tracks = append(out.Tracks, models.Track{
			ID: id, Name: it.TrackName, URI: "itunes:track:" + id, DurationMs: it.DurationMs, PreviewURL: &p,
			Artists: []models.ArtistSummary{{ID: "", Name: it.ArtistName}},
			Album:   models.AlbumSummary{Name: it.AlbumName, Images: []models.Image{{URL: strings.Replace(it.ArtURL, "100x100bb", "600x600bb", 1)}}},
		})
	}
	return out, nil
}
