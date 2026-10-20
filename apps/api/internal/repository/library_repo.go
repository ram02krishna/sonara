package repository

import (
	"context"
	"sync"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sonara/api/internal/models"
)

type LibraryRepository struct {
	db     *pgxpool.Pool
	mu     sync.RWMutex
	memLib map[uuid.UUID]map[string]models.Track
}

func NewLibraryRepository(db *pgxpool.Pool) *LibraryRepository {
	return &LibraryRepository{
		db:     db,
		memLib: make(map[uuid.UUID]map[string]models.Track),
	}
}

func (r *LibraryRepository) EnsureSchema(ctx context.Context) error {
	if r.db == nil {
		return nil
	}
	query := `
		CREATE TABLE IF NOT EXISTS user_library (
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			track_uri VARCHAR(255) NOT NULL,
			track_id VARCHAR(128) NOT NULL DEFAULT '',
			track_name VARCHAR(255) NOT NULL DEFAULT '',
			artist_name VARCHAR(255) NOT NULL DEFAULT '',
			album_name VARCHAR(255) NOT NULL DEFAULT '',
			album_art_url TEXT DEFAULT '',
			preview_url TEXT DEFAULT '',
			duration_ms INT NOT NULL DEFAULT 0,
			added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (user_id, track_uri)
		);
		CREATE INDEX IF NOT EXISTS idx_user_library_added ON user_library(user_id, added_at DESC);
	`
	_, err := r.db.Exec(ctx, query)
	return err
}

func (r *LibraryRepository) SaveTrack(ctx context.Context, userID uuid.UUID, t models.Track) error {
	if t.URI == "" {
		t.URI = "spotify:track:" + t.ID
	}
	artist := ""
	if len(t.Artists) > 0 {
		artist = t.Artists[0].Name
	}
	art := ""
	if len(t.Album.Images) > 0 {
		art = t.Album.Images[0].URL
	}
	preview := ""
	if t.PreviewURL != nil {
		preview = *t.PreviewURL
	}

	if r.db == nil {
		r.mu.Lock()
		defer r.mu.Unlock()
		if _, ok := r.memLib[userID]; !ok {
			r.memLib[userID] = make(map[string]models.Track)
		}
		r.memLib[userID][t.URI] = t
		return nil
	}

	query := `
		INSERT INTO user_library (user_id, track_uri, track_id, track_name, artist_name, album_name, album_art_url, preview_url, duration_ms)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (user_id, track_uri) DO NOTHING;
	`
	_, err := r.db.Exec(ctx, query, userID, t.URI, t.ID, t.Name, artist, t.Album.Name, art, preview, t.DurationMs)
	return err
}

func (r *LibraryRepository) RemoveTrack(ctx context.Context, userID uuid.UUID, trackURI string) error {
	if r.db == nil {
		r.mu.Lock()
		defer r.mu.Unlock()
		if tracks, ok := r.memLib[userID]; ok {
			delete(tracks, trackURI)
		}
		return nil
	}

	query := `DELETE FROM user_library WHERE user_id = $1 AND track_uri = $2;`
	_, err := r.db.Exec(ctx, query, userID, trackURI)
	return err
}

func (r *LibraryRepository) IsTrackSaved(ctx context.Context, userID uuid.UUID, trackURI string) (bool, error) {
	if r.db == nil {
		r.mu.RLock()
		defer r.mu.RUnlock()
		if tracks, ok := r.memLib[userID]; ok {
			_, exists := tracks[trackURI]
			return exists, nil
		}
		return false, nil
	}

	query := `SELECT EXISTS(SELECT 1 FROM user_library WHERE user_id = $1 AND track_uri = $2);`
	var exists bool
	err := r.db.QueryRow(ctx, query, userID, trackURI).Scan(&exists)
	return exists, err
}

func (r *LibraryRepository) GetSavedTracks(ctx context.Context, userID uuid.UUID, limit int) ([]models.Track, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	if r.db == nil {
		r.mu.RLock()
		defer r.mu.RUnlock()
		out := make([]models.Track, 0)
		if tracks, ok := r.memLib[userID]; ok {
			for _, t := range tracks {
				out = append(out, t)
				if len(out) >= limit {
					break
				}
			}
		}
		return out, nil
	}

	query := `
		SELECT track_id, track_uri, track_name, artist_name, album_name, album_art_url, preview_url, duration_ms
		FROM user_library
		WHERE user_id = $1
		ORDER BY added_at DESC
		LIMIT $2;
	`
	rows, err := r.db.Query(ctx, query, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]models.Track, 0)
	for rows.Next() {
		var id, uri, name, artist, album, art, preview string
		var durationMs int
		if err := rows.Scan(&id, &uri, &name, &artist, &album, &art, &preview, &durationMs); err != nil {
			return nil, err
		}
		var pURL *string
		if preview != "" {
			pURL = &preview
		}
		images := []models.Image{}
		if art != "" {
			images = append(images, models.Image{URL: art})
		}
		out = append(out, models.Track{
			ID:         id,
			Name:       name,
			URI:        uri,
			DurationMs: durationMs,
			PreviewURL: pURL,
			Artists:    []models.ArtistSummary{{Name: artist}},
			Album:      models.AlbumSummary{Name: album, Images: images},
		})
	}
	return out, nil
}
