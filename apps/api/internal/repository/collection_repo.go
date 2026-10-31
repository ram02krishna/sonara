package repository

import (
	"context"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrNoDatabase = errors.New("database unavailable: start PostgreSQL to use this feature")

// dbUserCollection is the GORM-mapped struct for user_collection.
type dbUserCollection struct {
	UserID   uuid.UUID    `gorm:"column:user_id;type:uuid;not null;primaryKey;index:idx_user_collection_added,priority:1"`
	Kind     string       `gorm:"column:kind;size:16;not null;primaryKey;index:idx_user_collection_added,priority:2"`
	ItemID   string       `gorm:"column:item_id;size:128;not null;primaryKey"`
	ItemJSON rawJSONField `gorm:"column:item_json;type:jsonb;not null"`
	AddedAt  time.Time    `gorm:"column:added_at;autoCreateTime;index:idx_user_collection_added,priority:3,sort:desc"`
}

func (dbUserCollection) TableName() string { return "user_collection" }

// rawJSONField handles any JSON value stored as jsonb.
type rawJSONField struct {
	data []byte
}

func (f *rawJSONField) Scan(val interface{}) error {
	if val == nil {
		f.data = []byte("{}")
		return nil
	}
	switch v := val.(type) {
	case []byte:
		f.data = v
	case string:
		f.data = []byte(v)
	default:
		return fmt.Errorf("rawJSONField: unsupported type %T", val)
	}
	return nil
}

func (f rawJSONField) Value() (driver.Value, error) {
	if len(f.data) == 0 {
		return "{}", nil
	}
	return string(f.data), nil
}

func (f rawJSONField) MarshalJSON() ([]byte, error) {
	if len(f.data) == 0 {
		return []byte("{}"), nil
	}
	return f.data, nil
}

func (f *rawJSONField) UnmarshalJSON(b []byte) error {
	f.data = b
	return nil
}

// CollectionRepository stores artists and albums a user follows or saves using GORM.
type CollectionRepository struct{ db *gorm.DB }

func NewCollectionRepository(db *gorm.DB) *CollectionRepository {
	return &CollectionRepository{db: db}
}

func (r *CollectionRepository) EnsureSchema(_ context.Context) error {
	if r.db == nil {
		return nil
	}
	if err := r.db.AutoMigrate(&dbUserCollection{}); err != nil {
		return err
	}
	return ensureCascadeFK(r.db, "user_collection", "user_id", "users")
}

func (r *CollectionRepository) Add(_ context.Context, userID uuid.UUID, kind, itemID string, item interface{}) error {
	if r.db == nil {
		return ErrNoDatabase
	}
	blob, err := json.Marshal(item)
	if err != nil {
		return err
	}
	row := dbUserCollection{
		UserID:   userID,
		Kind:     kind,
		ItemID:   itemID,
		ItemJSON: rawJSONField{data: blob},
	}
	return r.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "user_id"}, {Name: "kind"}, {Name: "item_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"item_json"}),
	}).Create(&row).Error
}

func (r *CollectionRepository) Remove(_ context.Context, userID uuid.UUID, kind, itemID string) error {
	if r.db == nil {
		return ErrNoDatabase
	}
	return r.db.Where("user_id = ? AND kind = ? AND item_id = ?", userID, kind, itemID).
		Delete(&dbUserCollection{}).Error
}

func (r *CollectionRepository) Has(_ context.Context, userID uuid.UUID, kind, itemID string) (bool, error) {
	if r.db == nil {
		return false, nil
	}
	var count int64
	err := r.db.Model(&dbUserCollection{}).
		Where("user_id = ? AND kind = ? AND item_id = ?", userID, kind, itemID).
		Count(&count).Error
	return count > 0, err
}

// List returns stored JSON documents for a kind, newest first.
func (r *CollectionRepository) List(_ context.Context, userID uuid.UUID, kind string, limit int) ([]json.RawMessage, error) {
	if r.db == nil {
		return []json.RawMessage{}, nil
	}
	var rows []dbUserCollection
	err := r.db.Select("item_json").
		Where("user_id = ? AND kind = ?", userID, kind).
		Order("added_at DESC").
		Limit(limit).
		Find(&rows).Error
	if err != nil {
		return nil, err
	}
	out := make([]json.RawMessage, 0, len(rows))
	for _, row := range rows {
		out = append(out, json.RawMessage(row.ItemJSON.data))
	}
	return out, nil
}
