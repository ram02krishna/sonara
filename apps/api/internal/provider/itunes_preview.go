package provider

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// ITunesPreviewClient resolves 30s audio previews for tracks whose Spotify
// preview_url is missing. Results are cached in memory (bounded).
type ITunesPreviewClient struct {
	httpClient *http.Client
	mu         sync.RWMutex
	cache      map[string]string
}

func NewITunesPreviewClient() *ITunesPreviewClient {
	return &ITunesPreviewClient{
		httpClient: &http.Client{Timeout: 6 * time.Second},
		cache:      make(map[string]string),
	}
}

func normalize(s string) string { return strings.ToLower(strings.TrimSpace(s)) }

func (c *ITunesPreviewClient) FindPreview(ctx context.Context, trackName, artistName string) (string, error) {
	key := normalize(trackName) + "|" + normalize(artistName)
	c.mu.RLock()
	if v, ok := c.cache[key]; ok {
		c.mu.RUnlock()
		return v, nil
	}
	c.mu.RUnlock()

	term := strings.TrimSpace(trackName + " " + artistName)
	apiURL := fmt.Sprintf("https://itunes.apple.com/search?term=%s&entity=song&limit=5", url.QueryEscape(term))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return "", err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("itunes preview lookup returned %d", resp.StatusCode)
	}

	var data struct {
		Results []struct {
			TrackName  string `json:"trackName"`
			ArtistName string `json:"artistName"`
			PreviewURL string `json:"previewUrl"`
		} `json:"results"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return "", err
	}

	best := ""
	for _, r := range data.Results {
		if r.PreviewURL == "" {
			continue
		}
		nameMatch := strings.Contains(normalize(r.TrackName), normalize(trackName)) || strings.Contains(normalize(trackName), normalize(r.TrackName))
		artistMatch := artistName == "" || strings.Contains(normalize(r.ArtistName), normalize(artistName)) || strings.Contains(normalize(artistName), normalize(r.ArtistName))
		if nameMatch && artistMatch {
			best = r.PreviewURL
			break
		}
	}

	c.mu.Lock()
	if len(c.cache) > 5000 {
		c.cache = make(map[string]string)
	}
	c.cache[key] = best
	c.mu.Unlock()
	return best, nil
}
