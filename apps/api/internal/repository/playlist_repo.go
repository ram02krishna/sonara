package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sonara/api/internal/models"
)

var ErrPlaylistNotFound = errors.New("playlist not found")

// PlaylistRepository stores Sonara's own user-created playlists.
type PlaylistRepository struct{ db *pgxpool.Pool }

func NewPlaylistRepository(db *pgxpool.Pool) *PlaylistRepository { return &PlaylistRepository{db: db} }

func (r *PlaylistRepository) EnsureSchema(ctx context.Context) error {
	if r.db == nil {
		return nil
	}
	_, err := r.db.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS sonara_playlists (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			name VARCHAR(120) NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		);
		CREATE INDEX IF NOT EXISTS idx_sonara_playlists_user ON sonara_playlists(user_id, updated_at DESC);
		CREATE TABLE IF NOT EXISTS sonara_playlist_tracks (
			id BIGSERIAL PRIMARY KEY,
			playlist_id UUID NOT NULL REFERENCES sonara_playlists(id) ON DELETE CASCADE,
			position INT NOT NULL,
			track_id VARCHAR(128) NOT NULL,
			track_json JSONB NOT NULL,
			added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		);
		CREATE INDEX IF NOT EXISTS idx_sonara_playlist_tracks ON sonara_playlist_tracks(playlist_id, position);`)
	return err
}

func (r *PlaylistRepository) Create(ctx context.Context, userID uuid.UUID, name, desc string) (*models.UserPlaylist, error) {
	if r.db == nil {
		return nil, ErrNoDatabase
	}
	p := &models.UserPlaylist{Tracks: []models.Track{}, Covers: []string{}}
	err := r.db.QueryRow(ctx, `
		INSERT INTO sonara_playlists (user_id, name, description) VALUES ($1, $2, $3)
		RETURNING id, name, description, created_at, updated_at`, userID, name, desc).
		Scan(&p.ID, &p.Name, &p.Description, &p.CreatedAt, &p.UpdatedAt)
	return p, err
}

// List returns the user's playlists with track counts and up to 4 cover images.
func (r *PlaylistRepository) List(ctx context.Context, userID uuid.UUID) ([]models.UserPlaylist, error) {
	if r.db == nil {
		return []models.UserPlaylist{}, nil
	}
	rows, err := r.db.Query(ctx, `
		SELECT p.id, p.name, p.description, p.created_at, p.updated_at,
		       (SELECT COUNT(*) FROM sonara_playlist_tracks t WHERE t.playlist_id = p.id)
		FROM sonara_playlists p WHERE p.user_id = $1 ORDER BY p.updated_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.UserPlaylist{}
	for rows.Next() {
		var p models.UserPlaylist
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.CreatedAt, &p.UpdatedAt, &p.TrackCount); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	rows.Close()
	for i := range out {
		out[i].Covers = r.covers(ctx, out[i].ID)
	}
	return out, nil
}

func (r *PlaylistRepository) covers(ctx context.Context, id uuid.UUID) []string {
	rows, err := r.db.Query(ctx, `
		SELECT track_json #>> '{album,images,0,url}' FROM sonara_playlist_tracks
		WHERE playlist_id = $1 ORDER BY position LIMIT 12`, id)
	if err != nil {
		return []string{}
	}
	defer rows.Close()
	seen := map[string]bool{}
	covers := []string{}
	for rows.Next() {
		var u *string
		if rows.Scan(&u) == nil && u != nil && *u != "" && !seen[*u] && len(covers) < 4 {
			seen[*u] = true
			covers = append(covers, *u)
		}
	}
	return covers
}

// Get returns a playlist with its tracks; it is only visible to its owner.
func (r *PlaylistRepository) Get(ctx context.Context, userID, id uuid.UUID) (*models.UserPlaylist, error) {
	if r.db == nil {
		return nil, ErrNoDatabase
	}
	p := &models.UserPlaylist{Tracks: []models.Track{}}
	err := r.db.QueryRow(ctx, `
		SELECT id, name, description, created_at, updated_at FROM sonara_playlists WHERE id = $1 AND user_id = $2`, id, userID).
		Scan(&p.ID, &p.Name, &p.Description, &p.CreatedAt, &p.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrPlaylistNotFound
	}
	if err != nil {
		return nil, err
	}
	rows, err := r.db.Query(ctx, `SELECT track_json FROM sonara_playlist_tracks WHERE playlist_id = $1 ORDER BY position`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var t models.Track
		if err := rows.Scan(&t); err != nil {
			return nil, err
		}
		p.Tracks = append(p.Tracks, t)
	}
	p.TrackCount = len(p.Tracks)
	rows.Close()
	p.Covers = r.covers(ctx, id)
	return p, nil
}

func (r *PlaylistRepository) owns(ctx context.Context, userID, id uuid.UUID) error {
	var ok bool
	if err := r.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM sonara_playlists WHERE id = $1 AND user_id = $2)`, id, userID).Scan(&ok); err != nil {
		return err
	}
	if !ok {
		return ErrPlaylistNotFound
	}
	return nil
}

func (r *PlaylistRepository) Update(ctx context.Context, userID, id uuid.UUID, name, desc string) error {
	if r.db == nil {
		return ErrNoDatabase
	}
	tag, err := r.db.Exec(ctx, `UPDATE sonara_playlists SET name = $3, description = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2`,
		id, userID, name, desc)
	if err == nil && tag.RowsAffected() == 0 {
		return ErrPlaylistNotFound
	}
	return err
}

func (r *PlaylistRepository) Delete(ctx context.Context, userID, id uuid.UUID) error {
	if r.db == nil {
		return ErrNoDatabase
	}
	tag, err := r.db.Exec(ctx, `DELETE FROM sonara_playlists WHERE id = $1 AND user_id = $2`, id, userID)
	if err == nil && tag.RowsAffected() == 0 {
		return ErrPlaylistNotFound
	}
	return err
}

// AddTracks appends tracks, skipping ones already in the playlist. It returns how many were added.
func (r *PlaylistRepository) AddTracks(ctx context.Context, userID, id uuid.UUID, tracks []models.Track) (int, error) {
	if r.db == nil {
		return 0, ErrNoDatabase
	}
	if err := r.owns(ctx, userID, id); err != nil {
		return 0, err
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	var next int
	if err := tx.QueryRow(ctx, `SELECT COALESCE(MAX(position) + 1, 0) FROM sonara_playlist_tracks WHERE playlist_id = $1`, id).Scan(&next); err != nil {
		return 0, err
	}
	added := 0
	for _, t := range tracks {
		if t.ID == "" {
			continue
		}
		var exists bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM sonara_playlist_tracks WHERE playlist_id = $1 AND track_id = $2)`, id, t.ID).Scan(&exists); err != nil {
			return 0, err
		}
		if exists {
			continue
		}
		if _, err := tx.Exec(ctx, `INSERT INTO sonara_playlist_tracks (playlist_id, position, track_id, track_json) VALUES ($1, $2, $3, $4)`,
			id, next, t.ID, t); err != nil {
			return 0, err
		}
		next++
		added++
	}
	if _, err := tx.Exec(ctx, `UPDATE sonara_playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`, id); err != nil {
		return 0, err
	}
	return added, tx.Commit(ctx)
}

// renumber rewrites positions 0..n-1 in the given order (used after remove/reorder).
func (r *PlaylistRepository) renumber(ctx context.Context, tx pgx.Tx, ids []int64) error {
	for i, rowID := range ids {
		if _, err := tx.Exec(ctx, `UPDATE sonara_playlist_tracks SET position = $2 WHERE id = $1`, rowID, i); err != nil {
			return err
		}
	}
	return nil
}

func (r *PlaylistRepository) orderedRowIDs(ctx context.Context, tx pgx.Tx, id uuid.UUID) ([]int64, error) {
	rows, err := tx.Query(ctx, `SELECT id FROM sonara_playlist_tracks WHERE playlist_id = $1 ORDER BY position`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []int64
	for rows.Next() {
		var v int64
		if err := rows.Scan(&v); err != nil {
			return nil, err
		}
		ids = append(ids, v)
	}
	return ids, rows.Err()
}

// RemoveTrack removes a track by its track id.
func (r *PlaylistRepository) RemoveTrack(ctx context.Context, userID, id uuid.UUID, trackID string) error {
	if r.db == nil {
		return ErrNoDatabase
	}
	if err := r.owns(ctx, userID, id); err != nil {
		return err
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `DELETE FROM sonara_playlist_tracks WHERE playlist_id = $1 AND track_id = $2`, id, trackID); err != nil {
		return err
	}
	ids, err := r.orderedRowIDs(ctx, tx, id)
	if err != nil {
		return err
	}
	if err := r.renumber(ctx, tx, ids); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE sonara_playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`, id); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// MoveTrack moves the track at index `from` to index `to`.
func (r *PlaylistRepository) MoveTrack(ctx context.Context, userID, id uuid.UUID, from, to int) error {
	if r.db == nil {
		return ErrNoDatabase
	}
	if err := r.owns(ctx, userID, id); err != nil {
		return err
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	ids, err := r.orderedRowIDs(ctx, tx, id)
	if err != nil {
		return err
	}
	if from < 0 || from >= len(ids) || to < 0 || to >= len(ids) {
		return errors.New("position out of range")
	}
	moved := ids[from]
	ids = append(ids[:from], ids[from+1:]...)
	ids = append(ids[:to], append([]int64{moved}, ids[to:]...)...)
	if err := r.renumber(ctx, tx, ids); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
