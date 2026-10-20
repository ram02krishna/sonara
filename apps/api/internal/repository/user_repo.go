package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sonara/api/internal/models"
)

type UserRepository struct {
	db *pgxpool.Pool
}

func NewUserRepository(db *pgxpool.Pool) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) UpsertUser(ctx context.Context, u *models.User) (*models.User, error) {
	if r.db == nil {
		// Mock / memory mode fallback if db unavailable during local mock testing
		if u.ID == uuid.Nil {
			u.ID = uuid.New()
		}
		return u, nil
	}

	query := `
		INSERT INTO users (spotify_id, display_name, email, avatar_url, product, country, encrypted_access_token, encrypted_refresh_token, token_expires_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
		ON CONFLICT (spotify_id) DO UPDATE SET
			display_name = EXCLUDED.display_name,
			email = EXCLUDED.email,
			avatar_url = EXCLUDED.avatar_url,
			product = EXCLUDED.product,
			country = EXCLUDED.country,
			encrypted_access_token = EXCLUDED.encrypted_access_token,
			encrypted_refresh_token = EXCLUDED.encrypted_refresh_token,
			token_expires_at = EXCLUDED.token_expires_at,
			updated_at = CURRENT_TIMESTAMP
		RETURNING id, created_at, updated_at;
	`

	err := r.db.QueryRow(ctx, query,
		u.SpotifyID,
		u.DisplayName,
		u.Email,
		u.AvatarURL,
		u.Product,
		u.Country,
		u.EncryptedAccessToken,
		u.EncryptedRefreshToken,
		u.TokenExpiresAt,
	).Scan(&u.ID, &u.CreatedAt, &u.UpdatedAt)

	if err != nil {
		return nil, err
	}

	return u, nil
}

func (r *UserRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	if r.db == nil {
		return nil, errors.New("db not connected")
	}

	query := `
		SELECT id, spotify_id, display_name, email, avatar_url, product, country,
		       encrypted_access_token, encrypted_refresh_token, token_expires_at, created_at, updated_at
		FROM users
		WHERE id = $1;
	`

	var u models.User
	err := r.db.QueryRow(ctx, query, id).Scan(
		&u.ID,
		&u.SpotifyID,
		&u.DisplayName,
		&u.Email,
		&u.AvatarURL,
		&u.Product,
		&u.Country,
		&u.EncryptedAccessToken,
		&u.EncryptedRefreshToken,
		&u.TokenExpiresAt,
		&u.CreatedAt,
		&u.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	return &u, nil
}

func (r *UserRepository) CreateSession(ctx context.Context, sessionID string, userID uuid.UUID, expiresAt time.Time) error {
	if r.db == nil {
		return nil
	}

	query := `
		INSERT INTO sessions (id, user_id, expires_at)
		VALUES ($1, $2, $3)
		ON CONFLICT (id) DO UPDATE SET expires_at = EXCLUDED.expires_at;
	`
	_, err := r.db.Exec(ctx, query, sessionID, userID, expiresAt)
	return err
}

func (r *UserRepository) GetUserBySession(ctx context.Context, sessionID string) (*models.User, error) {
	if r.db == nil {
		return nil, errors.New("db not connected")
	}

	query := `
		SELECT u.id, u.spotify_id, u.display_name, u.email, u.avatar_url, u.product, u.country,
		       u.encrypted_access_token, u.encrypted_refresh_token, u.token_expires_at, u.created_at, u.updated_at
		FROM users u
		JOIN sessions s ON s.user_id = u.id
		WHERE s.id = $1 AND s.expires_at > CURRENT_TIMESTAMP;
	`

	var u models.User
	err := r.db.QueryRow(ctx, query, sessionID).Scan(
		&u.ID,
		&u.SpotifyID,
		&u.DisplayName,
		&u.Email,
		&u.AvatarURL,
		&u.Product,
		&u.Country,
		&u.EncryptedAccessToken,
		&u.EncryptedRefreshToken,
		&u.TokenExpiresAt,
		&u.CreatedAt,
		&u.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	return &u, nil
}

func (r *UserRepository) DeleteSession(ctx context.Context, sessionID string) error {
	if r.db == nil {
		return nil
	}
	query := `DELETE FROM sessions WHERE id = $1;`
	_, err := r.db.Exec(ctx, query, sessionID)
	return err
}
