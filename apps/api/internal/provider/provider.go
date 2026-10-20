package provider

import (
	"context"

	"github.com/sonara/api/internal/models"
)

// MusicProvider defines the swappable music streaming catalog & playback contract
type MusicProvider interface {
	Name() string
	GetAppToken(ctx context.Context) (string, error)
	GetProfile(ctx context.Context, accessToken string) (*models.User, error)
	GetTopArtists(ctx context.Context, accessToken string, timeRange string, limit int) ([]models.Artist, error)
	GetTopTracks(ctx context.Context, accessToken string, timeRange string, limit int) ([]models.Track, error)
	GetRecentlyPlayed(ctx context.Context, accessToken string, limit int) ([]models.PlayHistoryItem, error)
	Search(ctx context.Context, accessToken string, query string, types string, limit int, market string) (*models.SearchResult, error)
	GetMyPlaylists(ctx context.Context, accessToken string, limit int) ([]models.PlaylistSummary, error)
	GetPlaylist(ctx context.Context, accessToken string, id string) (*models.PlaylistSummary, []models.Track, error)
	GetArtist(ctx context.Context, accessToken string, id string) (*models.Artist, error)
	SaveToLibrary(ctx context.Context, accessToken string, uris []string) error
	RemoveFromLibrary(ctx context.Context, accessToken string, uris []string) error
	LibraryContains(ctx context.Context, accessToken string, uris []string) ([]bool, error)
	GetSavedTracks(ctx context.Context, accessToken string, limit int) ([]models.Track, error)
	SearchNewAlbums(ctx context.Context, accessToken string, market string, limit int) ([]models.AlbumSummary, error)
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

// PreviewProvider finds a playable audio preview for a track. Spotify no longer
// returns preview_url to most apps, so this only enriches tracks that already
// came from Spotify; it never supplies catalog data.
type PreviewProvider interface {
	FindPreview(ctx context.Context, trackName, artistName string) (string, error)
}
