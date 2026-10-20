package provider

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/sonara/api/internal/models"
)

type LRCLIBClient struct {
	baseURL    string
	httpClient *http.Client
}

func NewLRCLIBClient(baseURL string) *LRCLIBClient {
	if baseURL == "" {
		baseURL = "https://lrclib.net/api"
	}
	return &LRCLIBClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 6 * time.Second,
		},
	}
}

type lrclibResponse struct {
	ID           int     `json:"id"`
	TrackName    string  `json:"trackName"`
	ArtistName   string  `json:"artistName"`
	AlbumName    string  `json:"albumName"`
	Duration     float64 `json:"duration"`
	Instrumental bool    `json:"instrumental"`
	PlainLyrics  string  `json:"plainLyrics"`
	SyncedLyrics string  `json:"syncedLyrics"`
}

var lrcLineRegex = regexp.MustCompile(`^\[(\d{2}):(\d{2}\.\d{2,3})\](.*)$`)

func (c *LRCLIBClient) GetLyrics(ctx context.Context, trackName, artistName string, durationMs int) (*models.Lyrics, error) {
	endpoint := fmt.Sprintf("%s/get", c.baseURL)
	reqURL, err := url.Parse(endpoint)
	if err != nil {
		return nil, err
	}

	q := reqURL.Query()
	q.Set("track_name", trackName)
	q.Set("artist_name", artistName)
	if durationMs > 0 {
		q.Set("duration", strconv.Itoa(durationMs/1000))
	}
	reqURL.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Sonara-Music-App/1.0 (https://github.com/sonara/api)")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("lyrics not found")
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("lrclib responded with status: %d", resp.StatusCode)
	}

	var data lrclibResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}

	result := &models.Lyrics{
		ID:          data.ID,
		TrackName:   data.TrackName,
		ArtistName:  data.ArtistName,
		PlainLyrics: data.PlainLyrics,
		Synced:      data.SyncedLyrics != "",
		Lines:       []models.LyricsLine{},
	}

	if data.SyncedLyrics != "" {
		lines := strings.Split(data.SyncedLyrics, "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			matches := lrcLineRegex.FindStringSubmatch(line)
			if len(matches) == 4 {
				min, _ := strconv.ParseFloat(matches[1], 64)
				sec, _ := strconv.ParseFloat(matches[2], 64)
				totalSec := min*60 + sec
				text := strings.TrimSpace(matches[3])
				result.Lines = append(result.Lines, models.LyricsLine{
					TimeSeconds: totalSec,
					Words:       text,
				})
			}
		}
	}

	return result, nil
}
