package repository

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sonara/api/internal/models"
)

type HistoryRepository struct {
	db *pgxpool.Pool
}

func NewHistoryRepository(db *pgxpool.Pool) *HistoryRepository {
	return &HistoryRepository{db: db}
}

// EnsureSchema adds the listened_ms column for databases created before it existed.
func (r *HistoryRepository) EnsureSchema(ctx context.Context) error {
	if r.db == nil {
		return nil
	}
	for _, q := range []string{
		`ALTER TABLE play_history ADD COLUMN IF NOT EXISTS listened_ms INT NOT NULL DEFAULT 0`,
		`ALTER TABLE play_history ADD COLUMN IF NOT EXISTS artist_id VARCHAR(64) NOT NULL DEFAULT ''`,
		`ALTER TABLE play_history ADD COLUMN IF NOT EXISTS track_json JSONB`,
		`CREATE INDEX IF NOT EXISTS idx_play_history_user_time ON play_history(user_id, played_at DESC)`,
	} {
		if _, err := r.db.Exec(ctx, q); err != nil {
			return err
		}
	}
	return nil
}

// RecordPlay stores one real play. listenedMs is how much audio the user could actually hear.
func (r *HistoryRepository) RecordPlay(ctx context.Context, userID uuid.UUID, track *models.Track, listenedMs int, source string) error {
	if r.db == nil {
		return nil
	}
	artist := ""
	if len(track.Artists) > 0 {
		artist = track.Artists[0].Name
	}
	art := ""
	if len(track.Album.Images) > 0 {
		art = track.Album.Images[0].URL
	}
	artistID := ""
	if len(track.Artists) > 0 {
		artistID = track.Artists[0].ID
	}
	blob, _ := json.Marshal(track)
	_, err := r.db.Exec(ctx, `
		INSERT INTO play_history (user_id, track_id, track_name, artist_name, album_name, album_art_url, duration_ms, listened_ms, source, artist_id, track_json)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		userID, track.ID, track.Name, artist, track.Album.Name, art, track.DurationMs, listenedMs, source, artistID, blob)
	return err
}

// GetStats computes real listening stats from recorded plays. No placeholder
// numbers: a user with no plays gets zeros and empty series.
func (r *HistoryRepository) GetStats(ctx context.Context, userID uuid.UUID, timeRange string) (*models.StatsReport, error) {
	report := &models.StatsReport{TopGenres: []models.GenreStat{}, DailyListening: []models.DailyListeningStat{}}
	if r.db == nil {
		return report, nil
	}

	since := time.Time{}
	switch timeRange {
	case "4weeks":
		since = time.Now().AddDate(0, 0, -28)
	case "6months":
		since = time.Now().AddDate(0, -6, 0)
	}

	var totalMs int64
	if err := r.db.QueryRow(ctx, `
		SELECT COUNT(*), COUNT(DISTINCT track_id), COUNT(DISTINCT COALESCE(NULLIF(artist_id, ''), artist_name)), COALESCE(SUM(listened_ms), 0)
		FROM play_history WHERE user_id = $1 AND played_at >= $2`, userID, since,
	).Scan(&report.PlayCount, &report.UniqueTracks, &report.UniqueArtists, &totalMs); err != nil {
		return nil, err
	}
	report.TotalMinutes = int(totalMs / 60000)

	// Activity series: per day for 4 weeks, per month otherwise.
	trunc, label := "month", "Mon YY"
	if timeRange == "4weeks" {
		trunc, label = "day", "DD Mon"
	}
	rows, err := r.db.Query(ctx, `
		SELECT to_char(date_trunc('`+trunc+`', played_at), '`+label+`') AS label,
		       COALESCE(SUM(listened_ms), 0) / 3600000.0 AS hours
		FROM play_history WHERE user_id = $1 AND played_at >= $2
		GROUP BY date_trunc('`+trunc+`', played_at)
		ORDER BY date_trunc('`+trunc+`', played_at)`, userID, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var d models.DailyListeningStat
		if err := rows.Scan(&d.Date, &d.Hours); err != nil {
			return nil, err
		}
		report.DailyListening = append(report.DailyListening, d)
	}

	// Streak: consecutive days with at least one play, ending today or yesterday.
	dayRows, err := r.db.Query(ctx, `
		SELECT DISTINCT (played_at AT TIME ZONE 'UTC')::date FROM play_history
		WHERE user_id = $1 ORDER BY 1 DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer dayRows.Close()
	var days []time.Time
	for dayRows.Next() {
		var d time.Time
		if err := dayRows.Scan(&d); err != nil {
			return nil, err
		}
		days = append(days, d)
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
func (r *HistoryRepository) Recent(ctx context.Context, userID uuid.UUID, limit int) ([]models.PlayHistoryItem, error) {
	if r.db == nil {
		return []models.PlayHistoryItem{}, nil
	}
	rows, err := r.db.Query(ctx, `
		SELECT track_json, played_at FROM play_history
		WHERE user_id = $1 AND track_json IS NOT NULL ORDER BY played_at DESC LIMIT 200`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.PlayHistoryItem{}
	seen := map[string]bool{}
	for rows.Next() {
		var t models.Track
		var at time.Time
		if err := rows.Scan(&t, &at); err != nil {
			return nil, err
		}
		if t.ID == "" || seen[t.ID] {
			continue
		}
		seen[t.ID] = true
		out = append(out, models.PlayHistoryItem{Track: t, PlayedAt: at})
		if len(out) >= limit {
			break
		}
	}
	return out, rows.Err()
}

// TopTracks ranks tracks by play count within the range.
func (r *HistoryRepository) TopTracks(ctx context.Context, userID uuid.UUID, timeRange string, limit int) ([]models.Track, error) {
	if r.db == nil {
		return []models.Track{}, nil
	}
	rows, err := r.db.Query(ctx, `
		SELECT (array_agg(track_json ORDER BY played_at DESC))[1]
		FROM play_history
		WHERE user_id = $1 AND played_at >= $2 AND track_json IS NOT NULL
		GROUP BY track_id ORDER BY COUNT(*) DESC, MAX(played_at) DESC LIMIT $3`, userID, rangeSince(timeRange), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.Track{}
	for rows.Next() {
		var t models.Track
		if err := rows.Scan(&t); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// TopArtists ranks artists (by Spotify id) by play count within the range.
func (r *HistoryRepository) TopArtists(ctx context.Context, userID uuid.UUID, timeRange string, limit int) ([]models.ArtistSummary, error) {
	if r.db == nil {
		return []models.ArtistSummary{}, nil
	}
	rows, err := r.db.Query(ctx, `
		SELECT artist_id, MAX(artist_name) FROM play_history
		WHERE user_id = $1 AND played_at >= $2 AND artist_id <> ''
		GROUP BY artist_id ORDER BY COUNT(*) DESC LIMIT $3`, userID, rangeSince(timeRange), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.ArtistSummary{}
	for rows.Next() {
		var a models.ArtistSummary
		if err := rows.Scan(&a.ID, &a.Name); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// Clear deletes a user's listening history.
func (r *HistoryRepository) Clear(ctx context.Context, userID uuid.UUID) error {
	if r.db == nil {
		return nil
	}
	_, err := r.db.Exec(ctx, `DELETE FROM play_history WHERE user_id = $1`, userID)
	return err
}
