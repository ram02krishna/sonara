package repository

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNoDatabase = errors.New("database unavailable: start PostgreSQL to use this feature")

// CollectionRepository stores items a user follows or saves: artists and albums.
type CollectionRepository struct{ db *pgxpool.Pool }

func NewCollectionRepository(db *pgxpool.Pool) *CollectionRepository {
	return &CollectionRepository{db: db}
}

func (r *CollectionRepository) EnsureSchema(ctx context.Context) error {
	if r.db == nil {
		return nil
	}
	_, err := r.db.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS user_collection (
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			kind VARCHAR(16) NOT NULL,
			item_id VARCHAR(128) NOT NULL,
			item_json JSONB NOT NULL,
			added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (user_id, kind, item_id)
		);
		CREATE INDEX IF NOT EXISTS idx_user_collection_added ON user_collection(user_id, kind, added_at DESC);`)
	return err
}

func (r *CollectionRepository) Add(ctx context.Context, userID uuid.UUID, kind, itemID string, item interface{}) error {
	if r.db == nil {
		return ErrNoDatabase
	}
	blob, err := json.Marshal(item)
	if err != nil {
		return err
	}
	_, err = r.db.Exec(ctx, `
		INSERT INTO user_collection (user_id, kind, item_id, item_json) VALUES ($1, $2, $3, $4)
		ON CONFLICT (user_id, kind, item_id) DO UPDATE SET item_json = EXCLUDED.item_json`, userID, kind, itemID, blob)
	return err
}

func (r *CollectionRepository) Remove(ctx context.Context, userID uuid.UUID, kind, itemID string) error {
	if r.db == nil {
		return ErrNoDatabase
	}
	_, err := r.db.Exec(ctx, `DELETE FROM user_collection WHERE user_id = $1 AND kind = $2 AND item_id = $3`, userID, kind, itemID)
	return err
}

func (r *CollectionRepository) Has(ctx context.Context, userID uuid.UUID, kind, itemID string) (bool, error) {
	if r.db == nil {
		return false, nil
	}
	var ok bool
	err := r.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM user_collection WHERE user_id = $1 AND kind = $2 AND item_id = $3)`,
		userID, kind, itemID).Scan(&ok)
	return ok, err
}

// List returns the stored JSON documents for a kind, newest first.
func (r *CollectionRepository) List(ctx context.Context, userID uuid.UUID, kind string, limit int) ([]json.RawMessage, error) {
	if r.db == nil {
		return []json.RawMessage{}, nil
	}
	rows, err := r.db.Query(ctx, `SELECT item_json FROM user_collection WHERE user_id = $1 AND kind = $2 ORDER BY added_at DESC LIMIT $3`,
		userID, kind, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []json.RawMessage{}
	for rows.Next() {
		var b []byte
		if err := rows.Scan(&b); err != nil {
			return nil, err
		}
		out = append(out, json.RawMessage(b))
	}
	return out, rows.Err()
}
