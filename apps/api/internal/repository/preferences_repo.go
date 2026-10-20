package repository

import (
	"context"
	"errors"
	"sync"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sonara/api/internal/models"
)

// PreferencesRepository stores each user's taste choices (languages, genres,
// artists, country). It falls back to memory when Postgres isn't available.
type PreferencesRepository struct {
	db  *pgxpool.Pool
	mu  sync.RWMutex
	mem map[uuid.UUID]models.Preferences
}

func NewPreferencesRepository(db *pgxpool.Pool) *PreferencesRepository {
	return &PreferencesRepository{db: db, mem: make(map[uuid.UUID]models.Preferences)}
}

// EnsureSchema creates the table for databases initialised before this feature existed.
func (r *PreferencesRepository) EnsureSchema(ctx context.Context) error {
	if r.db == nil {
		return nil
	}
	_, err := r.db.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS user_preferences (
			user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
			languages TEXT[] NOT NULL DEFAULT '{}',
			genres TEXT[] NOT NULL DEFAULT '{}',
			artists JSONB NOT NULL DEFAULT '[]',
			country VARCHAR(8) NOT NULL DEFAULT '',
			onboarded BOOLEAN NOT NULL DEFAULT false,
			audio_quality VARCHAR(32) NOT NULL DEFAULT 'lossless',
			normalize_audio BOOLEAN NOT NULL DEFAULT true,
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		)`)
	if err != nil {
		return err
	}
	_, _ = r.db.Exec(ctx, `ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS audio_quality VARCHAR(32) NOT NULL DEFAULT 'lossless'`)
	_, _ = r.db.Exec(ctx, `ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS normalize_audio BOOLEAN NOT NULL DEFAULT true`)
	return nil
}

func empty() models.Preferences {
	return models.Preferences{
		Languages:      []string{},
		Genres:         []string{},
		Artists:        []models.ArtistSummary{},
		AudioQuality:   "lossless",
		NormalizeAudio: true,
	}
}

func (r *PreferencesRepository) Get(ctx context.Context, userID uuid.UUID) (models.Preferences, error) {
	if r.db == nil {
		r.mu.RLock()
		defer r.mu.RUnlock()
		if p, ok := r.mem[userID]; ok {
			return p, nil
		}
		return empty(), nil
	}
	p := empty()
	var aq *string
	var na *bool
	err := r.db.QueryRow(ctx,
		`SELECT languages, genres, artists, country, onboarded, audio_quality, normalize_audio FROM user_preferences WHERE user_id = $1`, userID,
	).Scan(&p.Languages, &p.Genres, &p.Artists, &p.Country, &p.Onboarded, &aq, &na)
	if errors.Is(err, pgx.ErrNoRows) {
		return empty(), nil
	}
	if err != nil {
		return empty(), err
	}
	if p.Languages == nil {
		p.Languages = []string{}
	}
	if p.Genres == nil {
		p.Genres = []string{}
	}
	if p.Artists == nil {
		p.Artists = []models.ArtistSummary{}
	}
	if aq != nil && *aq != "" {
		p.AudioQuality = *aq
	} else {
		p.AudioQuality = "lossless"
	}
	if na != nil {
		p.NormalizeAudio = *na
	} else {
		p.NormalizeAudio = true
	}
	return p, nil
}

func (r *PreferencesRepository) Save(ctx context.Context, userID uuid.UUID, p models.Preferences) error {
	if p.Languages == nil {
		p.Languages = []string{}
	}
	if p.Genres == nil {
		p.Genres = []string{}
	}
	if p.Artists == nil {
		p.Artists = []models.ArtistSummary{}
	}
	if p.AudioQuality == "" {
		p.AudioQuality = "lossless"
	}
	if r.db == nil {
		r.mu.Lock()
		r.mem[userID] = p
		r.mu.Unlock()
		return nil
	}
	_, err := r.db.Exec(ctx, `
		INSERT INTO user_preferences (user_id, languages, genres, artists, country, onboarded, audio_quality, normalize_audio, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
		ON CONFLICT (user_id) DO UPDATE SET
			languages = EXCLUDED.languages, genres = EXCLUDED.genres, artists = EXCLUDED.artists,
			country = EXCLUDED.country, onboarded = EXCLUDED.onboarded,
			audio_quality = EXCLUDED.audio_quality, normalize_audio = EXCLUDED.normalize_audio,
			updated_at = CURRENT_TIMESTAMP`,
		userID, p.Languages, p.Genres, p.Artists, p.Country, p.Onboarded, p.AudioQuality, p.NormalizeAudio)
	return err
}
