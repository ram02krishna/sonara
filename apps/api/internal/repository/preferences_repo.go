package repository

import (
	"context"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/sonara/api/internal/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// dbUserPreference is the GORM-mapped struct for user_preferences.
//
// Onboarded and NormalizeAudio are pointers on purpose: GORM treats a zero value on a field
// that has a `default` tag as "not set" and inserts the column default instead, so a plain
// bool could never be saved as false (normalize_audio would always come back true).
type dbUserPreference struct {
	UserID         uuid.UUID         `gorm:"column:user_id;type:uuid;primaryKey"`
	Languages      pqStringArray     `gorm:"column:languages;type:text[];not null;default:'{}'"`
	Genres         pqStringArray     `gorm:"column:genres;type:text[];not null;default:'{}'"`
	Artists        artistSummaryJSON `gorm:"column:artists;type:jsonb;not null;default:'[]'"`
	Country        string            `gorm:"column:country;size:8;not null;default:''"`
	Onboarded      *bool             `gorm:"column:onboarded;not null;default:false"`
	AudioQuality   string            `gorm:"column:audio_quality;size:32;not null;default:'lossless'"`
	NormalizeAudio *bool             `gorm:"column:normalize_audio;not null;default:true"`
	UpdatedAt      time.Time         `gorm:"column:updated_at;autoUpdateTime"`
}

func (dbUserPreference) TableName() string { return "user_preferences" }

// pqStringArray handles PostgreSQL TEXT[] columns.
type pqStringArray []string

// Scan parses Postgres array text such as {rock,"hip hop","say \"hi\""}.
func (a *pqStringArray) Scan(val interface{}) error {
	switch v := val.(type) {
	case nil:
		*a = []string{}
		return nil
	case []string:
		*a = append([]string{}, v...)
		return nil
	case []byte:
		return a.scanText(string(v))
	case string:
		return a.scanText(v)
	default:
		return fmt.Errorf("pqStringArray: unsupported type %T", val)
	}
}

func (a *pqStringArray) scanText(s string) error {
	items, err := parsePGTextArray(s)
	if err != nil {
		return err
	}
	*a = items
	return nil
}

// Value renders the array as a Postgres array literal.
func (a pqStringArray) Value() (driver.Value, error) {
	return formatPGTextArray([]string(a)), nil
}

// parsePGTextArray decodes a one-dimensional Postgres text[] literal. Postgres only
// quotes elements when it has to, so {rock,pop} and {"hip hop"} are both valid input.
func parsePGTextArray(s string) ([]string, error) {
	s = strings.TrimSpace(s)
	if len(s) < 2 || s[0] != '{' || s[len(s)-1] != '}' {
		return nil, fmt.Errorf("pqStringArray: invalid array literal %q", s)
	}
	body := s[1 : len(s)-1]
	out := []string{}
	for i := 0; i < len(body); {
		var b strings.Builder
		if body[i] == '"' {
			i++
			for i < len(body) && body[i] != '"' {
				if body[i] == '\\' && i+1 < len(body) {
					i++
				}
				b.WriteByte(body[i])
				i++
			}
			i++ // closing quote
			out = append(out, b.String())
		} else {
			for i < len(body) && body[i] != ',' {
				b.WriteByte(body[i])
				i++
			}
			if v := strings.TrimSpace(b.String()); !strings.EqualFold(v, "NULL") {
				out = append(out, v)
			}
		}
		if i < len(body) && body[i] == ',' {
			i++
		}
	}
	return out, nil
}

// formatPGTextArray encodes a slice as a Postgres array literal with every element quoted.
func formatPGTextArray(a []string) string {
	parts := make([]string, len(a))
	for i, v := range a {
		v = strings.ReplaceAll(v, `\`, `\\`)
		v = strings.ReplaceAll(v, `"`, `\"`)
		parts[i] = `"` + v + `"`
	}
	return "{" + strings.Join(parts, ",") + "}"
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
	if err := r.db.AutoMigrate(&dbUserPreference{}); err != nil {
		return err
	}
	return ensureCascadeFK(r.db, "user_preferences", "user_id", "users")
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
	if err := r.db.First(&row, "user_id = ?", userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// No record yet is fine: return defaults. Real database errors are reported.
			return emptyPrefs(), nil
		}
		return models.Preferences{}, err
	}

	p := models.Preferences{
		Languages:      []string(row.Languages),
		Genres:         []string(row.Genres),
		Artists:        []models.ArtistSummary(row.Artists),
		Country:        row.Country,
		Onboarded:      row.Onboarded != nil && *row.Onboarded,
		AudioQuality:   row.AudioQuality,
		NormalizeAudio: row.NormalizeAudio == nil || *row.NormalizeAudio,
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
		Onboarded:      &p.Onboarded,
		AudioQuality:   p.AudioQuality,
		NormalizeAudio: &p.NormalizeAudio,
	}
	return r.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "user_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"languages", "genres", "artists", "country",
			"onboarded", "audio_quality", "normalize_audio", "updated_at",
		}),
	}).Create(&row).Error
}
