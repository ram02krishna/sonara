package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/sonara/api/internal/models"
)

// GetMyPlaylists lists the logged-in user's playlists (GET /me/playlists).
func (s *SpotifyProvider) GetMyPlaylists(ctx context.Context, accessToken string, limit int) ([]models.PlaylistSummary, error) {
	if limit <= 0 || limit > 50 {
		limit = 30
	}
	resp, err := s.doRequest(ctx, http.MethodGet, fmt.Sprintf("/me/playlists?limit=%d", limit), accessToken, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, errFromResponse(resp)
	}
	var data struct {
		Items []*rawPlaylist `json:"items"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}
	out := make([]models.PlaylistSummary, 0, len(data.Items))
	for _, p := range data.Items {
		if p == nil || p.ID == "" {
			continue
		}
		out = append(out, toPlaylistSummary(p))
	}
	return out, nil
}

func toPlaylistSummary(p *rawPlaylist) models.PlaylistSummary {
	total := 0
	if p.Items != nil {
		total = p.Items.Total
	} else if p.Tracks != nil {
		total = p.Tracks.Total
	}
	return models.PlaylistSummary{
		ID: p.ID, Name: p.Name, Description: p.Description, Images: p.Images,
		OwnerName: p.Owner.DisplayName, TracksTotal: total,
	}
}

// GetPlaylist returns playlist metadata plus tracks. Since Feb 2026 Spotify only
// returns playlist contents for playlists the user owns or collaborates on, so
// tracks may legitimately be empty. Both the new ("items"/"item") and legacy
// ("tracks"/"track") response shapes are accepted.
func (s *SpotifyProvider) GetPlaylist(ctx context.Context, accessToken string, id string) (*models.PlaylistSummary, []models.Track, error) {
	if accessToken == "" {
		if appTok, err := s.GetAppToken(ctx); err == nil {
			accessToken = appTok
		}
	}
	resp, err := s.doRequest(ctx, http.MethodGet, "/playlists/"+url.PathEscape(id), accessToken, nil)
	if err != nil {
		return nil, nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, nil, errFromResponse(resp)
	}

	var raw map[string]json.RawMessage
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, nil, err
	}
	var meta rawPlaylist
	b, _ := json.Marshal(raw)
	if err := json.Unmarshal(b, &meta); err != nil {
		return nil, nil, err
	}

	type page struct {
		Items []struct {
			Item  *rawTrack `json:"item"`
			Track *rawTrack `json:"track"`
		} `json:"items"`
	}
	var pg page
	for _, key := range []string{"items", "tracks"} {
		if rawPage, ok := raw[key]; ok {
			_ = json.Unmarshal(rawPage, &pg)
			if len(pg.Items) > 0 {
				break
			}
		}
	}

	tracks := make([]models.Track, 0, len(pg.Items))
	for _, it := range pg.Items {
		t := it.Item
		if t == nil {
			t = it.Track
		}
		if t == nil || t.ID == "" {
			continue
		}
		tracks = append(tracks, models.Track{
			ID: t.ID, Name: t.Name, URI: t.URI, PreviewURL: t.PreviewURL,
			DurationMs: t.DurationMs, Explicit: t.Explicit, Artists: t.Artists, Album: t.Album,
		})
	}
	summary := toPlaylistSummary(&meta)
	return &summary, tracks, nil
}

// GetArtist fetches one artist (GET /artists/{id}); batch artist fetches were removed in 2026.
func (s *SpotifyProvider) GetArtist(ctx context.Context, accessToken string, id string) (*models.Artist, error) {
	if accessToken == "" {
		if appTok, err := s.GetAppToken(ctx); err == nil {
			accessToken = appTok
		}
	}
	resp, err := s.doRequest(ctx, http.MethodGet, "/artists/"+url.PathEscape(id), accessToken, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, errFromResponse(resp)
	}
	var a rawArtist
	if err := json.NewDecoder(resp.Body).Decode(&a); err != nil {
		return nil, err
	}
	return &models.Artist{ID: a.ID, Name: a.Name, URI: a.URI, Genres: a.Genres, Images: a.Images}, nil
}

// libraryURIs sends the URI list as both the query string and JSON body: Spotify's
// Feb 2026 generic /me/library endpoints take Spotify URIs, and this keeps working
// whichever form the endpoint accepts.
func (s *SpotifyProvider) libraryWrite(ctx context.Context, method, accessToken string, uris []string) error {
	body, _ := json.Marshal(map[string][]string{"uris": uris})
	endpoint := "/me/library?uris=" + url.QueryEscape(strings.Join(uris, ","))
	resp, err := s.doRequest(ctx, method, endpoint, accessToken, bytes.NewReader(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return errFromResponse(resp)
	}
	return nil
}

func (s *SpotifyProvider) SaveToLibrary(ctx context.Context, accessToken string, uris []string) error {
	return s.libraryWrite(ctx, http.MethodPut, accessToken, uris)
}

func (s *SpotifyProvider) RemoveFromLibrary(ctx context.Context, accessToken string, uris []string) error {
	return s.libraryWrite(ctx, http.MethodDelete, accessToken, uris)
}

func (s *SpotifyProvider) LibraryContains(ctx context.Context, accessToken string, uris []string) ([]bool, error) {
	resp, err := s.doRequest(ctx, http.MethodGet, "/me/library/contains?uris="+url.QueryEscape(strings.Join(uris, ",")), accessToken, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, errFromResponse(resp)
	}
	var out []bool
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	return out, nil
}

// GetSavedTracks returns the user's Liked Songs.
func (s *SpotifyProvider) GetSavedTracks(ctx context.Context, accessToken string, limit int) ([]models.Track, error) {
	if limit <= 0 || limit > 50 {
		limit = 30
	}
	resp, err := s.doRequest(ctx, http.MethodGet, fmt.Sprintf("/me/tracks?limit=%d", limit), accessToken, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, errFromResponse(resp)
	}
	var data struct {
		Items []struct {
			Track *rawTrack `json:"track"`
		} `json:"items"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}
	out := make([]models.Track, 0, len(data.Items))
	for _, it := range data.Items {
		t := it.Track
		if t == nil || t.ID == "" {
			continue
		}
		out = append(out, models.Track{
			ID: t.ID, Name: t.Name, URI: t.URI, PreviewURL: t.PreviewURL, DurationMs: t.DurationMs,
			Explicit: t.Explicit, Artists: t.Artists, Album: t.Album, IsLiked: true,
		})
	}
	return out, nil
}
