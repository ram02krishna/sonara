package models

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID                   uuid.UUID `json:"id"`
	SpotifyID            string    `json:"spotify_id"`
	DisplayName          string    `json:"display_name"`
	Email                string    `json:"email"`
	AvatarURL            string    `json:"avatar_url"`
	Product              string    `json:"product"` // "premium" or "free"
	Country              string    `json:"country"`
	EncryptedAccessToken []byte    `json:"-"`
	EncryptedRefreshToken []byte   `json:"-"`
	TokenExpiresAt       time.Time `json:"-"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
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
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	URI         string   `json:"uri,omitempty"`
	ReleaseDate string   `json:"release_date,omitempty"`
	Images      []Image  `json:"images"`
}

type Track struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	URI         string          `json:"uri"`
	PreviewURL  *string         `json:"preview_url,omitempty"`
	DurationMs  int             `json:"duration_ms"`
	Explicit    bool            `json:"explicit"`
	Popularity  int             `json:"popularity"`
	Artists     []ArtistSummary `json:"artists"`
	Album       AlbumSummary    `json:"album"`
	IsLiked     bool            `json:"is_liked,omitempty"`
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
	TotalMinutes   int                  `json:"total_minutes"`
	StreakDays     int                  `json:"streak_days"`
	TopGenres      []GenreStat          `json:"top_genres"`
	DailyListening []DailyListeningStat `json:"daily_listening"`
}
