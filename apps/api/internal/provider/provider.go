package provider

import (
	"context"

	"github.com/sonara/api/internal/models"
)

// MusicProvider is Sonara's read-only catalogue source (Spotify via app credentials).
type MusicProvider interface {
	Name() string
	Configured() bool
	Search(ctx context.Context, query, types string, limit, offset int, market string) (*models.SearchResult, error)
	SearchNewAlbums(ctx context.Context, market string, limit int) ([]models.AlbumSummary, error)
	GetArtist(ctx context.Context, id string) (*models.Artist, error)
	GetArtistAlbums(ctx context.Context, id, market string, limit int) ([]models.AlbumSummary, error)
	GetAlbum(ctx context.Context, id, market string) (*models.AlbumDetail, error)
	GetTrack(ctx context.Context, id string) (*models.Track, error)
}

// LyricsProvider fetches plain and time-synced lyrics.
type LyricsProvider interface {
	GetLyrics(ctx context.Context, trackName, artistName string, durationMs int) (*models.Lyrics, error)
}

// PreviewProvider finds a playable 30s audio preview for a track. Spotify no
// longer returns preview_url to most apps, so previews come from iTunes.
type PreviewProvider interface {
	FindPreview(ctx context.Context, trackName, artistName string) (string, error)
}
