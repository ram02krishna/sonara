package models

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID           uuid.UUID `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	DisplayName  string    `json:"display_name"`
	AvatarURL    string    `json:"avatar_url"`
	Bio          string    `json:"bio,omitempty"`
	Product      string    `json:"product"` // "premium" for full Sonara studio access
	Country      string    `json:"country"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type Session struct {
	ID        string    `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
	ExpiresAt time.Time `json:"expires_at"`
}

type Image struct {
	URL    string `json:"url"`
	Height *int   `json:"height,omitempty"`
	Width  *int   `json:"width,omitempty"`
}

type ArtistSummary struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	URI  string `json:"uri,omitempty"`
}

type AlbumSummary struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	URI         string  `json:"uri,omitempty"`
	ReleaseDate string  `json:"release_date,omitempty"`
	Images      []Image `json:"images"`
}

type Track struct {
	ID         string          `json:"id"`
	Name       string          `json:"name"`
	URI        string          `json:"uri"`
	PreviewURL *string         `json:"preview_url,omitempty"`
	DurationMs int             `json:"duration_ms"`
	Explicit   bool            `json:"explicit"`
	Popularity int             `json:"popularity"`
	Artists    []ArtistSummary `json:"artists"`
	Album      AlbumSummary    `json:"album"`
	IsLiked    bool            `json:"is_liked,omitempty"`
}

type Artist struct {
	ID         string   `json:"id"`
	Name       string   `json:"name"`
	URI        string   `json:"uri"`
	Genres     []string `json:"genres"`
	Images     []Image  `json:"images"`
	Followers  int      `json:"followers,omitempty"`
	Popularity int      `json:"popularity,omitempty"`
}

type PlaylistSummary struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Description string  `json:"description,omitempty"`
	Images      []Image `json:"images"`
	OwnerName   string  `json:"owner_name,omitempty"`
	TracksTotal int     `json:"tracks_total,omitempty"`
}

type Device struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Type          string `json:"type"`
	IsActive      bool   `json:"is_active"`
	VolumePercent int    `json:"volume_percent,omitempty"`
}

type PlaybackState struct {
	Device       *Device `json:"device,omitempty"`
	IsPlaying    bool    `json:"is_playing"`
	Item         *Track  `json:"item,omitempty"`
	ProgressMs   int     `json:"progress_ms"`
	ShuffleState bool    `json:"shuffle_state"`
	RepeatState  string  `json:"repeat_state"`
}

type PlayHistoryItem struct {
	Track    Track     `json:"track"`
	PlayedAt time.Time `json:"played_at"`
}

type SearchResult struct {
	Tracks    []Track           `json:"tracks,omitempty"`
	Artists   []Artist          `json:"artists,omitempty"`
	Albums    []AlbumSummary    `json:"albums,omitempty"`
	Playlists []PlaylistSummary `json:"playlists,omitempty"`
}

type LyricsLine struct {
	TimeSeconds float64 `json:"time_seconds"`
	Words       string  `json:"words"`
}

type Lyrics struct {
	ID          int          `json:"id,omitempty"`
	TrackName   string       `json:"track_name"`
	ArtistName  string       `json:"artist_name"`
	Synced      bool         `json:"synced"`
	PlainLyrics string       `json:"plain_lyrics,omitempty"`
	Lines       []LyricsLine `json:"lines,omitempty"`
}

type GenreStat struct {
	Genre      string  `json:"genre"`
	Percentage float64 `json:"percentage"`
}

type DailyListeningStat struct {
	Date  string  `json:"date"`
	Hours float64 `json:"hours"`
}

type StatsReport struct {
	PlayCount      int                  `json:"play_count"`
	UniqueTracks   int                  `json:"unique_tracks"`
	UniqueArtists  int                  `json:"unique_artists"`
	TotalMinutes   int                  `json:"total_minutes"`
	StreakDays     int                  `json:"streak_days"`
	TopGenres      []GenreStat          `json:"top_genres"`
	DailyListening []DailyListeningStat `json:"daily_listening"`
}

// Preferences holds a user's explicit taste choices (first-login picker).
// They seed the dashboard for new users and are blended with real listening
// data for everyone else, so each account sees its own languages and genres.
type Preferences struct {
	Languages      []string        `json:"languages"`
	Genres         []string        `json:"genres"`
	Artists        []ArtistSummary `json:"artists"`
	Country        string          `json:"country,omitempty"` // ISO-3166 alpha-2
	Onboarded      bool            `json:"onboarded"`
	AudioQuality   string          `json:"audio_quality,omitempty"`
	NormalizeAudio bool            `json:"normalize_audio,omitempty"`
}

// DashboardSection is one server-driven block of the home screen.
// Type controls layout ("hero" | "carousel" | "grid"); Kind says which of
// Tracks/Artists/Albums is populated.
type DashboardSection struct {
	ID       string         `json:"id"`
	Type     string         `json:"type"`
	Kind     string         `json:"kind"`
	Title    string         `json:"title"`
	Subtitle string         `json:"subtitle,omitempty"`
	Tracks   []Track        `json:"tracks,omitempty"`
	Artists  []Artist       `json:"artists,omitempty"`
	Albums   []AlbumSummary `json:"albums,omitempty"`
}

type DashboardResponse struct {
	Sections        []DashboardSection `json:"sections"`
	TopGenres       []string           `json:"top_genres"`
	NeedsOnboarding bool               `json:"needs_onboarding"`
	Market          string             `json:"market"`
	GeneratedAt     time.Time          `json:"generated_at"`
}

// AlbumDetail is an album with its tracks (album pages).
type AlbumDetail struct {
	Album       AlbumSummary    `json:"album"`
	Artists     []ArtistSummary `json:"artists"`
	Label       string          `json:"label,omitempty"`
	TotalTracks int             `json:"total_tracks"`
	Tracks      []Track         `json:"tracks"`
}

// UserPlaylist is a playlist created by a Sonara user.
type UserPlaylist struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	TrackCount  int       `json:"track_count"`
	Covers      []string  `json:"covers"`
	Tracks      []Track   `json:"tracks,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
