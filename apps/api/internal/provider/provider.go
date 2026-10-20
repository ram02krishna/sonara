package provider

import (
	"context"

	"github.com/sonara/api/internal/models"
)

// MusicProvider defines the swappable music streaming catalog & playback contract
type MusicProvider interface {
	Name() string
	GetProfile(ctx context.Context, accessToken string) (*models.User, error)
	GetTopArtists(ctx context.Context, accessToken string, timeRange string, limit int) ([]models.Artist, error)
	GetTopTracks(ctx context.Context, accessToken string, timeRange string, limit int) ([]models.Track, error)
	GetRecentlyPlayed(ctx context.Context, accessToken string, limit int) ([]models.PlayHistoryItem, error)
	Search(ctx context.Context, accessToken string, query string, types string, limit int) (*models.SearchResult, error)
	GetPlaybackState(ctx context.Context, accessToken string) (*models.PlaybackState, error)
	GetDevices(ctx context.Context, accessToken string) ([]models.Device, error)
	TransferPlayback(ctx context.Context, accessToken string, deviceIDs []string, play bool) error
	Play(ctx context.Context, accessToken string, deviceID string, body map[string]interface{}) error
	Pause(ctx context.Context, accessToken string, deviceID string) error
	Next(ctx context.Context, accessToken string, deviceID string) error
	Previous(ctx context.Context, accessToken string, deviceID string) error
	Seek(ctx context.Context, accessToken string, positionMs int) error
	SetVolume(ctx context.Context, accessToken string, volumePercent int) error
}

// LyricsProvider defines the contract for fetching plain and time-synced lyrics
type LyricsProvider interface {
	GetLyrics(ctx context.Context, trackName, artistName string, durationMs int) (*models.Lyrics, error)
}
