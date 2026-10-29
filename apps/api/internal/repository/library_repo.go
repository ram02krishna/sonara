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

// dbUserLibrary is the GORM-mapped struct for the user_library table.
type dbUserLibrary struct {
	UserID      uuid.UUID         `gorm:"column:user_id;type:uuid;not null;primaryKey;index:idx_user_library_added,priority:1"`
	TrackURI    string            `gorm:"column:track_uri;size:255;not null;primaryKey"`
	TrackID     string            `gorm:"column:track_id;size:128;not null;default:''"`
	TrackName   string            `gorm:"column:track_name;size:255;not null;default:''"`
	ArtistName  string            `gorm:"column:artist_name;size:255;not null;default:''"`
	AlbumName   string            `gorm:"column:album_name;size:255;not null;default:''"`
	AlbumArtURL string            `gorm:"column:album_art_url;default:''"`
	PreviewURL  string            `gorm:"column:preview_url;default:''"`
	DurationMs  int               `gorm:"column:duration_ms;not null;default:0"`
	AddedAt     time.Time         `gorm:"column:added_at;autoCreateTime;index:idx_user_library_added,priority:2,sort:desc"`
	TrackJSON   *libraryTrackJSON `gorm:"column:track_json;type:jsonb"`
}

func (dbUserLibrary) TableName() string { return "user_library" }

// libraryTrackJSON wraps models.Track for JSONB storage.
type libraryTrackJSON struct {
	models.Track
}

func (t *libraryTrackJSON) Scan(val interface{}) error {
	var b []byte
	switch v := val.(type) {
	case []byte:
		b = v
	case string:
		b = []byte(v)
	default:
		return fmt.Errorf("libraryTrackJSON: unsupported type %T", val)
	}
	return json.Unmarshal(b, &t.Track)
}

func (t libraryTrackJSON) Value() (driver.Value, error) {
	b, err := json.Marshal(t.Track)
	return string(b), err
}

type LibraryRepository struct {
	db     *gorm.DB
	mu     sync.RWMutex
	memLib map[uuid.UUID]map[string]models.Track
}

func NewLibraryRepository(db *gorm.DB) *LibraryRepository {
	return &LibraryRepository{
		db:     db,
		memLib: make(map[uuid.UUID]map[string]models.Track),
	}
}

func (r *LibraryRepository) EnsureSchema(_ context.Context) error {
	if r.db == nil {
		return nil
	}
	return r.db.AutoMigrate(&dbUserLibrary{})
}

func (r *LibraryRepository) SaveTrack(_ context.Context, userID uuid.UUID, t models.Track) error {
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

	row := dbUserLibrary{
		UserID:      userID,
		TrackURI:    t.URI,
		TrackID:     t.ID,
		TrackName:   t.Name,
		ArtistName:  artist,
		AlbumName:   t.Album.Name,
		AlbumArtURL: art,
		PreviewURL:  preview,
		DurationMs:  t.DurationMs,
		TrackJSON:   &libraryTrackJSON{Track: t},
	}
	return r.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "user_id"}, {Name: "track_uri"}},
		DoUpdates: clause.AssignmentColumns([]string{"track_json"}),
	}).Create(&row).Error
}

func (r *LibraryRepository) RemoveTrack(_ context.Context, userID uuid.UUID, trackURI string) error {
	if r.db == nil {
		r.mu.Lock()
		defer r.mu.Unlock()
		if tracks, ok := r.memLib[userID]; ok {
			delete(tracks, trackURI)
		}
		return nil
	}
	return r.db.Where("user_id = ? AND track_uri = ?", userID, trackURI).Delete(&dbUserLibrary{}).Error
}

func (r *LibraryRepository) IsTrackSaved(_ context.Context, userID uuid.UUID, trackURI string) (bool, error) {
	if r.db == nil {
		r.mu.RLock()
		defer r.mu.RUnlock()
		if tracks, ok := r.memLib[userID]; ok {
			_, exists := tracks[trackURI]
			return exists, nil
		}
		return false, nil
	}

	var count int64
	err := r.db.Model(&dbUserLibrary{}).Where("user_id = ? AND track_uri = ?", userID, trackURI).Count(&count).Error
	return count > 0, err
}

func (r *LibraryRepository) GetSavedTracks(_ context.Context, userID uuid.UUID, limit int) ([]models.Track, error) {
	if limit <= 0 || limit > 1000 {
		limit = 500
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

	var rows []dbUserLibrary
	err := r.db.Select("track_id, track_uri, track_name, artist_name, album_name, album_art_url, preview_url, duration_ms, track_json").
		Where("user_id = ?", userID).
		Order("added_at DESC").
		Limit(limit).
		Find(&rows).Error
	if err != nil {
		return nil, err
	}

	out := make([]models.Track, 0, len(rows))
	for _, row := range rows {
		if row.TrackJSON != nil && row.TrackJSON.ID != "" {
			t := row.TrackJSON.Track
			t.IsLiked = true
			out = append(out, t)
			continue
		}
		var pURL *string
		if row.PreviewURL != "" {
			pURL = &row.PreviewURL
		}
		images := []models.Image{}
		if row.AlbumArtURL != "" {
			images = append(images, models.Image{URL: row.AlbumArtURL})
		}
		out = append(out, models.Track{
			ID:         row.TrackID,
			Name:       row.TrackName,
			URI:        row.TrackURI,
			DurationMs: row.DurationMs,
			PreviewURL: pURL,
			Artists:    []models.ArtistSummary{{Name: row.ArtistName}},
			Album:      models.AlbumSummary{Name: row.AlbumName, Images: images},
		})
	}
	return out, nil
}
