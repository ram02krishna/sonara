package repository

import (
	"context"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/sonara/api/internal/models"
	"gorm.io/gorm"
)

// dbPlayHistory is the GORM-mapped struct for the play_history table.
type dbPlayHistory struct {
	ID          uuid.UUID       `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()"`
	UserID      uuid.UUID       `gorm:"column:user_id;type:uuid;not null;index:idx_play_history_user_time,priority:1"`
	TrackID     string          `gorm:"column:track_id;size:128;not null"`
	TrackName   string          `gorm:"column:track_name;size:255;not null"`
	ArtistName  string          `gorm:"column:artist_name;size:255;not null;default:''"`
	ArtistID    string          `gorm:"column:artist_id;size:64;not null;default:''"`
	AlbumName   string          `gorm:"column:album_name;size:255;not null;default:''"`
	AlbumArtURL string          `gorm:"column:album_art_url;default:''"`
	DurationMs  int             `gorm:"column:duration_ms;not null;default:0"`
	ListenedMs  int             `gorm:"column:listened_ms;not null;default:0"`
	Source      string          `gorm:"column:source;size:64;default:'stream'"`
	TrackJSON   *trackJSONField `gorm:"column:track_json;type:jsonb"`
	PlayedAt    time.Time       `gorm:"column:played_at;index:idx_play_history_user_time,priority:2,sort:desc;autoCreateTime"`
}

func (dbPlayHistory) TableName() string { return "play_history" }

// trackJSONField implements GORM's Scanner/Valuer for JSONB ↔ models.Track.
type trackJSONField struct {
	models.Track
}

func (t *trackJSONField) Scan(val interface{}) error {
	if val == nil {
		return nil
	}
	var b []byte
	switch v := val.(type) {
	case []byte:
		b = v
	case string:
		b = []byte(v)
	default:
		return fmt.Errorf("trackJSONField: unsupported type %T", val)
	}
	return json.Unmarshal(b, &t.Track)
}

func (t trackJSONField) Value() (driver.Value, error) {
	b, err := json.Marshal(t.Track)
	return string(b), err
}

// HistoryRepository stores and queries play history using GORM.
type HistoryRepository struct {
	db *gorm.DB
}

func NewHistoryRepository(db *gorm.DB) *HistoryRepository {
	return &HistoryRepository{db: db}
}

// EnsureSchema auto-migrates the play_history table.
func (r *HistoryRepository) EnsureSchema(_ context.Context) error {
	if r.db == nil {
		return nil
	}
	if err := r.db.AutoMigrate(&dbPlayHistory{}); err != nil {
		return err
	}
	return ensureCascadeFK(r.db, "play_history", "user_id", "users")
}

// RecordPlay stores one real play. listenedMs is how much audio the user actually heard.
func (r *HistoryRepository) RecordPlay(_ context.Context, userID uuid.UUID, track *models.Track, listenedMs int, source string) error {
	if r.db == nil {
		return nil
	}
	artist := ""
	if len(track.Artists) > 0 {
		artist = track.Artists[0].Name
	}
	artistID := ""
	if len(track.Artists) > 0 {
		artistID = track.Artists[0].ID
	}
	art := ""
	if len(track.Album.Images) > 0 {
		art = track.Album.Images[0].URL
	}

	row := dbPlayHistory{
		UserID:      userID,
		TrackID:     track.ID,
		TrackName:   track.Name,
		ArtistName:  artist,
		ArtistID:    artistID,
		AlbumName:   track.Album.Name,
		AlbumArtURL: art,
		DurationMs:  track.DurationMs,
		ListenedMs:  listenedMs,
		Source:      source,
		TrackJSON:   &trackJSONField{Track: *track},
	}
	return r.db.Create(&row).Error
}

// GetStats computes real listening stats from recorded plays.
func (r *HistoryRepository) GetStats(_ context.Context, userID uuid.UUID, timeRange string) (*models.StatsReport, error) {
	report := &models.StatsReport{TopGenres: []models.GenreStat{}, DailyListening: []models.DailyListeningStat{}}
	if r.db == nil {
		return report, nil
	}

	since := rangeSince(timeRange)

	var row struct {
		PlayCount     int
		UniqueTracks  int
		UniqueArtists int
		TotalMs       int64
	}
	err := r.db.Raw(`
		SELECT
			COUNT(*) AS play_count,
			COUNT(DISTINCT track_id) AS unique_tracks,
			COUNT(DISTINCT COALESCE(NULLIF(artist_id, ''), artist_name)) AS unique_artists,
			COALESCE(SUM(listened_ms), 0) AS total_ms
		FROM play_history
		WHERE user_id = ? AND played_at >= ?`, userID, since).Scan(&row).Error
	if err != nil {
		return nil, err
	}
	report.PlayCount = row.PlayCount
	report.UniqueTracks = row.UniqueTracks
	report.UniqueArtists = row.UniqueArtists
	report.TotalMinutes = int(row.TotalMs / 60000)

	// Activity series: per day for 4 weeks, per month otherwise.
	trunc, label := "month", "Mon YY"
	if timeRange == "4weeks" || timeRange == "short_term" {
		trunc, label = "day", "DD Mon"
	}
	var daily []struct {
		Label string
		Hours float64
	}
	err = r.db.Raw(`
		SELECT to_char(date_trunc('`+trunc+`', played_at), '`+label+`') AS label,
		       COALESCE(SUM(listened_ms), 0) / 3600000.0 AS hours
		FROM play_history
		WHERE user_id = ? AND played_at >= ?
		GROUP BY date_trunc('`+trunc+`', played_at)
		ORDER BY date_trunc('`+trunc+`', played_at)`, userID, since).Scan(&daily).Error
	if err != nil {
		return nil, err
	}
	for _, d := range daily {
		report.DailyListening = append(report.DailyListening, models.DailyListeningStat{
			Date:  d.Label,
			Hours: d.Hours,
		})
	}

	// Streak: consecutive days with at least one play.
	var days []time.Time
	err = r.db.Raw(`
		SELECT DISTINCT (played_at AT TIME ZONE 'UTC')::date
		FROM play_history
		WHERE user_id = ?
		ORDER BY 1 DESC`, userID).Scan(&days).Error
	if err != nil {
		return nil, err
	}
	report.StreakDays = streakFrom(days, time.Now().UTC())
	return report, nil
}

// streakFrom counts consecutive days (newest first) ending today or yesterday.
func streakFrom(daysDesc []time.Time, now time.Time) int {
	if len(daysDesc) == 0 {
		return 0
	}
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	expected := today
	if d := daysDesc[0]; !d.Equal(today) {
		if d.Equal(today.AddDate(0, 0, -1)) {
			expected = today.AddDate(0, 0, -1)
		} else {
			return 0
		}
	}
	streak := 0
	for _, d := range daysDesc {
		if d.Equal(expected) {
			streak++
			expected = expected.AddDate(0, 0, -1)
		} else if d.Before(expected) {
			break
		}
	}
	return streak
}

func rangeSince(timeRange string) time.Time {
	switch timeRange {
	case "4weeks", "short_term":
		return time.Now().AddDate(0, 0, -28)
	case "6months", "medium_term":
		return time.Now().AddDate(0, -6, 0)
	}
	return time.Time{}
}

// Recent returns the user's most recently played distinct tracks, newest first.
func (r *HistoryRepository) Recent(_ context.Context, userID uuid.UUID, limit int) ([]models.PlayHistoryItem, error) {
	if r.db == nil {
		return []models.PlayHistoryItem{}, nil
	}

	var rows []struct {
		TrackJSON *trackJSONField `gorm:"column:track_json"`
		PlayedAt  time.Time       `gorm:"column:played_at"`
	}
	err := r.db.Raw(`
		SELECT track_json, played_at FROM play_history
		WHERE user_id = ? AND track_json IS NOT NULL
		ORDER BY played_at DESC LIMIT 200`, userID).Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	out := []models.PlayHistoryItem{}
	seen := map[string]bool{}
	for _, row := range rows {
		if row.TrackJSON == nil || row.TrackJSON.ID == "" || seen[row.TrackJSON.ID] {
			continue
		}
		seen[row.TrackJSON.ID] = true
		out = append(out, models.PlayHistoryItem{Track: row.TrackJSON.Track, PlayedAt: row.PlayedAt})
		if len(out) >= limit {
			break
		}
	}
	return out, nil
}

// TopTracks ranks tracks by play count within the range.
func (r *HistoryRepository) TopTracks(_ context.Context, userID uuid.UUID, timeRange string, limit int) ([]models.Track, error) {
	if r.db == nil {
		return []models.Track{}, nil
	}

	var rows []struct {
		TrackJSON *trackJSONField `gorm:"column:track_json"`
	}
	err := r.db.Raw(`
		SELECT (array_agg(track_json ORDER BY played_at DESC))[1] AS track_json
		FROM play_history
		WHERE user_id = ? AND played_at >= ? AND track_json IS NOT NULL
		GROUP BY track_id
		ORDER BY COUNT(*) DESC, MAX(played_at) DESC
		LIMIT ?`, userID, rangeSince(timeRange), limit).Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	out := []models.Track{}
	for _, row := range rows {
		if row.TrackJSON != nil {
			out = append(out, row.TrackJSON.Track)
		}
	}
	return out, nil
}

// TopArtists ranks artists by play count within the range.
func (r *HistoryRepository) TopArtists(_ context.Context, userID uuid.UUID, timeRange string, limit int) ([]models.ArtistSummary, error) {
	if r.db == nil {
		return []models.ArtistSummary{}, nil
	}

	var rows []struct {
		ArtistID   string `gorm:"column:artist_id"`
		ArtistName string `gorm:"column:artist_name"`
	}
	err := r.db.Raw(`
		SELECT artist_id, MAX(artist_name) AS artist_name
		FROM play_history
		WHERE user_id = ? AND played_at >= ? AND artist_id <> ''
		GROUP BY artist_id
		ORDER BY COUNT(*) DESC
		LIMIT ?`, userID, rangeSince(timeRange), limit).Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	out := []models.ArtistSummary{}
	for _, row := range rows {
		out = append(out, models.ArtistSummary{ID: row.ArtistID, Name: row.ArtistName})
	}
	return out, nil
}

// Clear deletes a user's listening history.
func (r *HistoryRepository) Clear(_ context.Context, userID uuid.UUID) error {
	if r.db == nil {
		return nil
	}
	return r.db.Where("user_id = ?", userID).Delete(&dbPlayHistory{}).Error
}
