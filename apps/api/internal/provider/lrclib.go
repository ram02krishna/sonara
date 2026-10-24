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

func cleanTrackName(name string) string {
	cleaned := name
	reParen := regexp.MustCompile(`(?i)\s*[\(\[][^\)\]]*(from|feat|ft\.|with|soundtrack|version|remaster|ost|live|edition|deluxe|bonus)[^\)\]]*[\)\]]`)
	cleaned = reParen.ReplaceAllString(cleaned, "")

	reEndParen := regexp.MustCompile(`\s*[\(\[][^\)\]]*[\)\]]$`)
	cleaned = reEndParen.ReplaceAllString(cleaned, "")

	if idx := strings.Index(cleaned, " - "); idx != -1 {
		cleaned = cleaned[:idx]
	}

	return strings.TrimSpace(cleaned)
}

func primaryArtist(artist string) string {
	separators := []string{",", "/", ";", " & ", " feat.", " ft."}
	for _, sep := range separators {
		if idx := strings.Index(artist, sep); idx != -1 {
			artist = artist[:idx]
		}
	}
	return strings.TrimSpace(artist)
}

func (c *LRCLIBClient) fetchGet(ctx context.Context, trackName, artistName string, durationMs int) (*lrclibResponse, error) {
	reqURL, err := url.Parse(fmt.Sprintf("%s/get", c.baseURL))
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

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("status %d", resp.StatusCode)
	}

	var data lrclibResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}
	return &data, nil
}

func (c *LRCLIBClient) fetchSearch(ctx context.Context, queryParams url.Values) (*lrclibResponse, error) {
	reqURL, err := url.Parse(fmt.Sprintf("%s/search", c.baseURL))
	if err != nil {
		return nil, err
	}
	reqURL.RawQuery = queryParams.Encode()

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

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("search status %d", resp.StatusCode)
	}

	var list []lrclibResponse
	if err := json.NewDecoder(resp.Body).Decode(&list); err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, fmt.Errorf("empty search results")
	}

	// Prefer first with synced lyrics, else first with plain lyrics
	for _, it := range list {
		if strings.TrimSpace(it.SyncedLyrics) != "" {
			return &it, nil
		}
	}
	for _, it := range list {
		if strings.TrimSpace(it.PlainLyrics) != "" {
			return &it, nil
		}
	}
	return &list[0], nil
}

func (c *LRCLIBClient) GetLyrics(ctx context.Context, trackName, artistName string, durationMs int) (*models.Lyrics, error) {
	var data *lrclibResponse

	// Attempt 1: Direct /get with exact parameters
	res, err := c.fetchGet(ctx, trackName, artistName, durationMs)
	if err == nil && res != nil && (res.SyncedLyrics != "" || res.PlainLyrics != "") {
		data = res
	}

	cleanTitle := cleanTrackName(trackName)
	primArtist := primaryArtist(artistName)

	// Attempt 2: /get with cleaned title and primary artist (no strict duration)
	if data == nil && (cleanTitle != trackName || primArtist != artistName) {
		res, err := c.fetchGet(ctx, cleanTitle, primArtist, 0)
		if err == nil && res != nil && (res.SyncedLyrics != "" || res.PlainLyrics != "") {
			data = res
		}
	}

	// Attempt 3: /search?track_name=...&artist_name=...
	if data == nil {
		q := url.Values{}
		q.Set("track_name", cleanTitle)
		if primArtist != "" {
			q.Set("artist_name", primArtist)
		}
		res, err := c.fetchSearch(ctx, q)
		if err == nil && res != nil {
			data = res
		}
	}

	// Attempt 4: /search?q=...
	if data == nil {
		q := url.Values{}
		queryStr := strings.TrimSpace(cleanTitle + " " + primArtist)
		if queryStr != "" {
			q.Set("q", queryStr)
			res, err := c.fetchSearch(ctx, q)
			if err == nil && res != nil {
				data = res
			}
		}
	}

	if data == nil || (strings.TrimSpace(data.SyncedLyrics) == "" && strings.TrimSpace(data.PlainLyrics) == "") {
		return nil, fmt.Errorf("lyrics not found")
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
