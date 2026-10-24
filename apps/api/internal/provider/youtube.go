package provider

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"
)

// YouTubeClient finds an embeddable official video for a track through the
// YouTube Data API v3 (requires YOUTUBE_API_KEY). Sonara plays the result in
// YouTube's own *visible* embedded player, as YouTube's terms require; it never
// scrapes YouTube pages or hides the player.
type YouTubeClient struct {
	key        string
	httpClient *http.Client
	mu         sync.Mutex
	cache      map[string]Video
	sf         singleflight.Group
}

// Video is a resolved YouTube video.
type Video struct {
	ID      string `json:"video_id"`
	Title   string `json:"title"`
	Channel string `json:"channel"`
}

func NewYouTubeClient(key string) *YouTubeClient {
	transport := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   5 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		MaxIdleConns:        50,
		MaxIdleConnsPerHost: 20,
		IdleConnTimeout:     90 * time.Second,
		TLSHandshakeTimeout: 5 * time.Second,
	}
	return &YouTubeClient{
		key:        key,
		httpClient: &http.Client{Timeout: 8 * time.Second, Transport: transport},
		cache:      map[string]Video{},
	}
}

func (c *YouTubeClient) Enabled() bool { return c != nil && c.key != "" }

func (c *YouTubeClient) FindVideo(ctx context.Context, name, artist string) (*Video, error) {
	if !c.Enabled() {
		return nil, fmt.Errorf("video playback is not configured")
	}
	cacheKey := strings.ToLower(name + "|" + artist)
	c.mu.Lock()
	if v, ok := c.cache[cacheKey]; ok {
		c.mu.Unlock()
		if v.ID == "" {
			return nil, fmt.Errorf("no video found")
		}
		return &v, nil
	}
	c.mu.Unlock()

	res, err, _ := c.sf.Do(cacheKey, func() (interface{}, error) {
		q := url.Values{}
		q.Set("part", "snippet")
		q.Set("type", "video")
		q.Set("videoEmbeddable", "true")
		q.Set("videoCategoryId", "10") // Music
		q.Set("maxResults", "1")
		q.Set("q", strings.TrimSpace(name+" "+artist+" official audio"))
		q.Set("key", c.key)
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://www.googleapis.com/youtube/v3/search?"+q.Encode(), nil)
		if err != nil {
			return nil, err
		}
		resp, err := c.httpClient.Do(req)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("youtube api returned %d", resp.StatusCode)
		}
		var data struct {
			Items []struct {
				ID struct {
					VideoID string `json:"videoId"`
				} `json:"id"`
				Snippet struct {
					Title        string `json:"title"`
					ChannelTitle string `json:"channelTitle"`
				} `json:"snippet"`
			} `json:"items"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
			return nil, err
		}
		v := Video{}
		if len(data.Items) > 0 {
			it := data.Items[0]
			v = Video{ID: it.ID.VideoID, Title: it.Snippet.Title, Channel: it.Snippet.ChannelTitle}
		}
		c.mu.Lock()
		if len(c.cache) > 2000 {
			c.cache = map[string]Video{}
		}
		c.cache[cacheKey] = v
		c.mu.Unlock()
		if v.ID == "" {
			return nil, fmt.Errorf("no video found")
		}
		return &v, nil
	})
	if err != nil {
		return nil, err
	}
	return res.(*Video), nil
}
