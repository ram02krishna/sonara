package repository

import (
	"context"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/sonara/api/internal/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrPlaylistNotFound = errors.New("playlist not found")

// dbPlaylist is the GORM-mapped struct for sonara_playlists.
type dbPlaylist struct {
	ID          uuid.UUID `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()"`
	UserID      uuid.UUID `gorm:"column:user_id;type:uuid;not null;index:idx_sonara_playlists_user,sort:desc,priority:1"`
	Name        string    `gorm:"column:name;size:120;not null"`
	Description string    `gorm:"column:description;not null;default:''"`
	CreatedAt   time.Time `gorm:"column:created_at;autoCreateTime"`
	UpdatedAt   time.Time `gorm:"column:updated_at;autoUpdateTime;index:idx_sonara_playlists_user,sort:desc,priority:2"`
}

func (dbPlaylist) TableName() string { return "sonara_playlists" }

// dbPlaylistTrack is the GORM-mapped struct for sonara_playlist_tracks.
type dbPlaylistTrack struct {
	ID         int64              `gorm:"column:id;primaryKey;autoIncrement"`
	PlaylistID uuid.UUID          `gorm:"column:playlist_id;type:uuid;not null;index:idx_sonara_playlist_tracks,priority:1"`
	Position   int                `gorm:"column:position;not null;index:idx_sonara_playlist_tracks,priority:2"`
	TrackID    string             `gorm:"column:track_id;size:128;not null"`
	TrackJSON  *playlistTrackJSON `gorm:"column:track_json;type:jsonb;not null"`
	AddedAt    time.Time          `gorm:"column:added_at;autoCreateTime"`
}

func (dbPlaylistTrack) TableName() string { return "sonara_playlist_tracks" }

// playlistTrackJSON wraps models.Track for JSONB storage in playlist tracks.
type playlistTrackJSON struct {
	models.Track
}

func (t *playlistTrackJSON) Scan(val interface{}) error {
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
		return fmt.Errorf("playlistTrackJSON: unsupported type %T", val)
	}
	return json.Unmarshal(b, &t.Track)
}

func (t playlistTrackJSON) Value() (driver.Value, error) {
	b, err := json.Marshal(t.Track)
	return string(b), err
}

// PlaylistRepository stores Sonara's own user-created playlists using GORM.
type PlaylistRepository struct{ db *gorm.DB }

func NewPlaylistRepository(db *gorm.DB) *PlaylistRepository { return &PlaylistRepository{db: db} }

func (r *PlaylistRepository) EnsureSchema(_ context.Context) error {
	if r.db == nil {
		return nil
	}
	if err := r.db.AutoMigrate(&dbPlaylist{}, &dbPlaylistTrack{}); err != nil {
		return err
	}
	if err := ensureCascadeFK(r.db, "sonara_playlists", "user_id", "users"); err != nil {
		return err
	}
	return ensureCascadeFK(r.db, "sonara_playlist_tracks", "playlist_id", "sonara_playlists")
}

func (r *PlaylistRepository) Create(_ context.Context, userID uuid.UUID, name, desc string) (*models.UserPlaylist, error) {
	if r.db == nil {
		return nil, ErrNoDatabase
	}
	row := dbPlaylist{UserID: userID, Name: name, Description: desc}
	if err := r.db.Create(&row).Error; err != nil {
		return nil, err
	}
	return &models.UserPlaylist{
		ID:          row.ID,
		Name:        row.Name,
		Description: row.Description,
		Tracks:      []models.Track{},
		Covers:      []string{},
		CreatedAt:   row.CreatedAt,
		UpdatedAt:   row.UpdatedAt,
	}, nil
}

// List returns the user's playlists with track counts and up to 4 cover images.
func (r *PlaylistRepository) List(_ context.Context, userID uuid.UUID) ([]models.UserPlaylist, error) {
	if r.db == nil {
		return []models.UserPlaylist{}, nil
	}

	var rows []dbPlaylist
	if err := r.db.Where("user_id = ?", userID).Order("updated_at DESC").Find(&rows).Error; err != nil {
		return nil, err
	}

	out := make([]models.UserPlaylist, 0, len(rows))
	if len(rows) == 0 {
		return out, nil
	}
	ids := make([]uuid.UUID, len(rows))
	for i, row := range rows {
		ids[i] = row.ID
	}

	var counts []struct {
		PlaylistID uuid.UUID
		N          int
	}
	if err := r.db.Raw(`SELECT playlist_id, COUNT(*) AS n FROM sonara_playlist_tracks WHERE playlist_id IN ? GROUP BY playlist_id`, ids).Scan(&counts).Error; err != nil {
		return nil, err
	}
	countByID := make(map[uuid.UUID]int, len(counts))
	for _, c := range counts {
		countByID[c.PlaylistID] = c.N
	}

	var coverRows []struct {
		PlaylistID uuid.UUID
		URL        string
	}
	if err := r.db.Raw(`
		SELECT playlist_id, COALESCE(url, '') AS url FROM (
			SELECT playlist_id, position,
			       track_json #>> '{album,images,0,url}' AS url,
			       ROW_NUMBER() OVER (PARTITION BY playlist_id ORDER BY position) AS rn
			FROM sonara_playlist_tracks WHERE playlist_id IN ?
		) t WHERE rn <= 12
		ORDER BY playlist_id, position`, ids).Scan(&coverRows).Error; err != nil {
		return nil, err
	}
	urlsByID := make(map[uuid.UUID][]string, len(rows))
	for _, c := range coverRows {
		urlsByID[c.PlaylistID] = append(urlsByID[c.PlaylistID], c.URL)
	}

	for _, row := range rows {
		out = append(out, models.UserPlaylist{
			ID:          row.ID,
			Name:        row.Name,
			Description: row.Description,
			TrackCount:  countByID[row.ID],
			Covers:      pickCovers(urlsByID[row.ID]),
			CreatedAt:   row.CreatedAt,
			UpdatedAt:   row.UpdatedAt,
		})
	}
	return out, nil
}

// pickCovers keeps up to four distinct, non-empty artwork URLs in order.
func pickCovers(urls []string) []string {
	seen := map[string]bool{}
	covers := []string{}
	for _, u := range urls {
		if u != "" && !seen[u] && len(covers) < 4 {
			seen[u] = true
			covers = append(covers, u)
		}
	}
	return covers
}

func (r *PlaylistRepository) covers(id uuid.UUID) []string {
	var urls []string
	r.db.Raw(`
		SELECT COALESCE(track_json #>> '{album,images,0,url}', '') AS url
		FROM sonara_playlist_tracks
		WHERE playlist_id = ?
		ORDER BY position
		LIMIT 12`, id).Scan(&urls)
	return pickCovers(urls)
}

// Get returns a playlist with its tracks; it is only visible to its owner.
func (r *PlaylistRepository) Get(_ context.Context, userID, id uuid.UUID) (*models.UserPlaylist, error) {
	if r.db == nil {
		return nil, ErrNoDatabase
	}

	var row dbPlaylist
	if err := r.db.Where("id = ? AND user_id = ?", id, userID).First(&row).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrPlaylistNotFound
		}
		return nil, err
	}

	var trackRows []dbPlaylistTrack
	if err := r.db.Where("playlist_id = ?", id).Order("position").Find(&trackRows).Error; err != nil {
		return nil, err
	}

	tracks := make([]models.Track, 0, len(trackRows))
	for _, tr := range trackRows {
		if tr.TrackJSON != nil {
			tracks = append(tracks, tr.TrackJSON.Track)
		}
	}

	return &models.UserPlaylist{
		ID:          row.ID,
		Name:        row.Name,
		Description: row.Description,
		TrackCount:  len(tracks),
		Covers:      r.covers(id),
		Tracks:      tracks,
		CreatedAt:   row.CreatedAt,
		UpdatedAt:   row.UpdatedAt,
	}, nil
}

func (r *PlaylistRepository) owns(userID, id uuid.UUID) error {
	var count int64
	if err := r.db.Model(&dbPlaylist{}).Where("id = ? AND user_id = ?", id, userID).Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return ErrPlaylistNotFound
	}
	return nil
}

func (r *PlaylistRepository) Update(_ context.Context, userID, id uuid.UUID, name, desc string) error {
	if r.db == nil {
		return ErrNoDatabase
	}
	result := r.db.Model(&dbPlaylist{}).
		Where("id = ? AND user_id = ?", id, userID).
		Updates(map[string]interface{}{"name": name, "description": desc, "updated_at": time.Now()})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrPlaylistNotFound
	}
	return nil
}

func (r *PlaylistRepository) Delete(_ context.Context, userID, id uuid.UUID) error {
	if r.db == nil {
		return ErrNoDatabase
	}
	result := r.db.Where("id = ? AND user_id = ?", id, userID).Delete(&dbPlaylist{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrPlaylistNotFound
	}
	return nil
}

// AddTracks appends tracks, skipping ones already in the playlist. Returns how many were added.
// The playlist row is locked for the duration so concurrent adds cannot reuse a position.
func (r *PlaylistRepository) AddTracks(_ context.Context, userID, id uuid.UUID, tracks []models.Track) (int, error) {
	if r.db == nil {
		return 0, ErrNoDatabase
	}

	added := 0
	err := r.db.Transaction(func(tx *gorm.DB) error {
		var pl dbPlaylist
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND user_id = ?", id, userID).First(&pl).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrPlaylistNotFound
			}
			return err
		}

		var next int
		if err := tx.Raw("SELECT COALESCE(MAX(position) + 1, 0) FROM sonara_playlist_tracks WHERE playlist_id = ?", id).Scan(&next).Error; err != nil {
			return err
		}
		var existing []string
		if err := tx.Model(&dbPlaylistTrack{}).Where("playlist_id = ?", id).Pluck("track_id", &existing).Error; err != nil {
			return err
		}
		have := make(map[string]bool, len(existing)+len(tracks))
		for _, tid := range existing {
			have[tid] = true
		}

		var rows []dbPlaylistTrack
		for _, t := range tracks {
			if t.ID == "" || have[t.ID] {
				continue
			}
			have[t.ID] = true
			rows = append(rows, dbPlaylistTrack{
				PlaylistID: id,
				Position:   next,
				TrackID:    t.ID,
				TrackJSON:  &playlistTrackJSON{Track: t},
			})
			next++
		}
		if len(rows) > 0 {
			if err := tx.Create(&rows).Error; err != nil {
				return err
			}
		}
		added = len(rows)
		return tx.Model(&dbPlaylist{}).Where("id = ?", id).Update("updated_at", time.Now()).Error
	})
	if err != nil {
		return 0, err
	}
	return added, nil
}

// renumber rewrites positions 0..n-1 in the given order.
func (r *PlaylistRepository) renumber(tx *gorm.DB, ids []int64) error {
	for i, rowID := range ids {
		if err := tx.Model(&dbPlaylistTrack{}).Where("id = ?", rowID).Update("position", i).Error; err != nil {
			return err
		}
	}
	return nil
}

func (r *PlaylistRepository) orderedRowIDs(tx *gorm.DB, id uuid.UUID) ([]int64, error) {
	var ids []int64
	err := tx.Model(&dbPlaylistTrack{}).Select("id").Where("playlist_id = ?", id).Order("position").Pluck("id", &ids).Error
	return ids, err
}

// RemoveTrack removes a track by its track id and renumbers the remaining ones.
func (r *PlaylistRepository) RemoveTrack(_ context.Context, userID, id uuid.UUID, trackID string) error {
	if r.db == nil {
		return ErrNoDatabase
	}
	if err := r.owns(userID, id); err != nil {
		return err
	}

	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("playlist_id = ? AND track_id = ?", id, trackID).Delete(&dbPlaylistTrack{}).Error; err != nil {
			return err
		}
		ids, err := r.orderedRowIDs(tx, id)
		if err != nil {
			return err
		}
		if err := r.renumber(tx, ids); err != nil {
			return err
		}
		return tx.Model(&dbPlaylist{}).Where("id = ?", id).Update("updated_at", time.Now()).Error
	})
}

// MoveTrack moves the track at index `from` to index `to`.
func (r *PlaylistRepository) MoveTrack(_ context.Context, userID, id uuid.UUID, from, to int) error {
	if r.db == nil {
		return ErrNoDatabase
	}
	if err := r.owns(userID, id); err != nil {
		return err
	}

	return r.db.Transaction(func(tx *gorm.DB) error {
		ids, err := r.orderedRowIDs(tx, id)
		if err != nil {
			return err
		}
		if from < 0 || from >= len(ids) || to < 0 || to >= len(ids) {
			return ErrInvalidPosition
		}
		moved := ids[from]
		ids = append(ids[:from], ids[from+1:]...)
		newIDs := make([]int64, 0, len(ids)+1)
		newIDs = append(newIDs, ids[:to]...)
		newIDs = append(newIDs, moved)
		newIDs = append(newIDs, ids[to:]...)
		return r.renumber(tx, newIDs)
	})
}
