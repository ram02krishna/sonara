package repository

import (
	"context"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/sonara/api/internal/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// dbUserPreference is the GORM-mapped struct for user_preferences.
type dbUserPreference struct {
	UserID         uuid.UUID          `gorm:"column:user_id;type:uuid;primaryKey"`
	Languages      pqStringArray      `gorm:"column:languages;type:text[];not null;default:'{}'"`
	Genres         pqStringArray      `gorm:"column:genres;type:text[];not null;default:'{}'"`
	Artists        artistSummaryJSON  `gorm:"column:artists;type:jsonb;not null;default:'[]'"`
	Country        string             `gorm:"column:country;size:8;not null;default:''"`
	Onboarded      bool               `gorm:"column:onboarded;not null;default:false"`
	AudioQuality   string             `gorm:"column:audio_quality;size:32;not null;default:'lossless'"`
	NormalizeAudio bool               `gorm:"column:normalize_audio;not null;default:true"`
	UpdatedAt      time.Time          `gorm:"column:updated_at;autoUpdateTime"`
}

func (dbUserPreference) TableName() string { return "user_preferences" }

// pqStringArray handles PostgreSQL TEXT[] columns.
type pqStringArray []string

func (a *pqStringArray) Scan(val interface{}) error {
	if val == nil {
		*a = []string{}
		return nil
	}
	var b []byte
	switch v := val.(type) {
	case []byte:
		b = v
	case string:
		b = []byte(v)
	default:
		return fmt.Errorf("pqStringArray: unsupported type %T", val)
	}
	// PostgreSQL arrays come in as {"a","b","c"} notation.
	// Use pgx-style parsing via json alternative for simplicity:
	// Convert {a,b,c} → ["a","b","c"] and unmarshal.
	s := string(b)
	if len(s) >= 2 && s[0] == '{' && s[len(s)-1] == '}' {
		inner := s[1 : len(s)-1]
		if inner == "" {
			*a = []string{}
			return nil
		}
		// Re-encode as JSON array for safe unmarshal.
		jsonStr := "[" + inner + "]"
		return json.Unmarshal([]byte(jsonStr), a)
	}
	return json.Unmarshal(b, a)
}

func (a pqStringArray) Value() (driver.Value, error) {
	if len(a) == 0 {
		return "{}", nil
	}
	// Build PostgreSQL array literal: '{"a","b"}'
	b, err := json.Marshal([]string(a))
	if err != nil {
		return nil, err
	}
	// Convert ["a","b"] → {"a","b"}
	s := string(b)
	return "{" + s[1:len(s)-1] + "}", nil
}

// artistSummaryJSON handles []models.ArtistSummary stored as JSONB.
type artistSummaryJSON []models.ArtistSummary

func (a *artistSummaryJSON) Scan(val interface{}) error {
	if val == nil {
		*a = []models.ArtistSummary{}
		return nil
	}
	var b []byte
	switch v := val.(type) {
	case []byte:
		b = v
	case string:
		b = []byte(v)
	default:
		return fmt.Errorf("artistSummaryJSON: unsupported type %T", val)
	}
	return json.Unmarshal(b, a)
}

func (a artistSummaryJSON) Value() (driver.Value, error) {
	if a == nil {
		return "[]", nil
	}
	b, err := json.Marshal([]models.ArtistSummary(a))
	return string(b), err
}

// PreferencesRepository stores each user's taste choices using GORM.
type PreferencesRepository struct {
	db  *gorm.DB
	mu  sync.RWMutex
	mem map[uuid.UUID]models.Preferences
}

func NewPreferencesRepository(db *gorm.DB) *PreferencesRepository {
	return &PreferencesRepository{db: db, mem: make(map[uuid.UUID]models.Preferences)}
}

// EnsureSchema auto-migrates the user_preferences table.
func (r *PreferencesRepository) EnsureSchema(_ context.Context) error {
	if r.db == nil {
		return nil
	}
	return r.db.AutoMigrate(&dbUserPreference{})
}

func emptyPrefs() models.Preferences {
	return models.Preferences{
		Languages:      []string{},
		Genres:         []string{},
		Artists:        []models.ArtistSummary{},
		AudioQuality:   "lossless",
		NormalizeAudio: true,
	}
}

func (r *PreferencesRepository) Get(_ context.Context, userID uuid.UUID) (models.Preferences, error) {
	if r.db == nil {
		r.mu.RLock()
		defer r.mu.RUnlock()
		if p, ok := r.mem[userID]; ok {
			return p, nil
		}
		return emptyPrefs(), nil
	}

	var row dbUserPreference
	result := r.db.First(&row, "user_id = ?", userID)
	if result.Error != nil {
		// No record is fine — return defaults.
		return emptyPrefs(), nil
	}

	p := models.Preferences{
		Languages:      []string(row.Languages),
		Genres:         []string(row.Genres),
		Artists:        []models.ArtistSummary(row.Artists),
		Country:        row.Country,
		Onboarded:      row.Onboarded,
		AudioQuality:   row.AudioQuality,
		NormalizeAudio: row.NormalizeAudio,
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
	if p.AudioQuality == "" {
		p.AudioQuality = "lossless"
	}
	return p, nil
}

func (r *PreferencesRepository) Save(_ context.Context, userID uuid.UUID, p models.Preferences) error {
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

	row := dbUserPreference{
		UserID:         userID,
		Languages:      pqStringArray(p.Languages),
		Genres:         pqStringArray(p.Genres),
		Artists:        artistSummaryJSON(p.Artists),
		Country:        p.Country,
		Onboarded:      p.Onboarded,
		AudioQuality:   p.AudioQuality,
		NormalizeAudio: p.NormalizeAudio,
	}
	return r.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "user_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"languages", "genres", "artists", "country",
			"onboarded", "audio_quality", "normalize_audio", "updated_at",
		}),
	}).Create(&row).Error
}
