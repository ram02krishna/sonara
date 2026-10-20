package repository

import (
	"context"
	"errors"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sonara/api/internal/models"
)

type UserRepository struct {
	db       *pgxpool.Pool
	mu       sync.RWMutex
	memUsers map[uuid.UUID]*models.User
	memEmail map[string]uuid.UUID
	memSess  map[string]models.Session
}

func NewUserRepository(db *pgxpool.Pool) *UserRepository {
	repo := &UserRepository{
		db:       db,
		memUsers: make(map[uuid.UUID]*models.User),
		memEmail: make(map[string]uuid.UUID),
		memSess:  make(map[string]models.Session),
	}

	// Seed default Sonara profile for immediate offline / memory listening
	defaultID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	defaultUser := &models.User{
		ID:          defaultID,
		Email:       "listener@sonara.app",
		DisplayName: "Sonara Listener",
		AvatarURL:   "",
		Bio:         "Studio Master Sound Enthusiast",
		Product:     "premium",
		Country:     "US",
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	repo.memUsers[defaultID] = defaultUser
	repo.memEmail["listener@sonara.app"] = defaultID

	return repo
}

// EnsureSchema updates the users & sessions tables for native Sonara accounts
func (r *UserRepository) EnsureSchema(ctx context.Context) error {
	if r.db == nil {
		return nil
	}

	queries := []string{
		`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`,
		`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`,
		`CREATE TABLE IF NOT EXISTS users (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			email VARCHAR(255) UNIQUE NOT NULL,
			password_hash VARCHAR(255) NOT NULL DEFAULT '',
			display_name VARCHAR(255) NOT NULL,
			avatar_url TEXT DEFAULT '',
			bio TEXT DEFAULT '',
			product VARCHAR(64) DEFAULT 'premium',
			country VARCHAR(8) DEFAULT 'US',
			created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		);`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NOT NULL DEFAULT '';`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS product VARCHAR(64) DEFAULT 'premium';`,
		`DO $$ 
		BEGIN 
			IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='spotify_id') THEN 
				ALTER TABLE users ALTER COLUMN spotify_id DROP NOT NULL; 
			END IF;
			IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='encrypted_access_token') THEN 
				ALTER TABLE users ALTER COLUMN encrypted_access_token DROP NOT NULL; 
			END IF;
			IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='encrypted_refresh_token') THEN 
				ALTER TABLE users ALTER COLUMN encrypted_refresh_token DROP NOT NULL; 
			END IF;
			IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='token_expires_at') THEN 
				ALTER TABLE users ALTER COLUMN token_expires_at DROP NOT NULL; 
			END IF;
		END $$;`,
		`CREATE TABLE IF NOT EXISTS sessions (
			id VARCHAR(128) PRIMARY KEY,
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
			expires_at TIMESTAMP WITH TIME ZONE NOT NULL
		);`,
		`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`,
		`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);`,
	}

	for _, q := range queries {
		if _, err := r.db.Exec(ctx, q); err != nil {
			// Continue on non-fatal warnings
		}
	}
	return nil
}

func (r *UserRepository) CreateUser(ctx context.Context, u *models.User) (*models.User, error) {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	now := time.Now()
	u.CreatedAt = now
	u.UpdatedAt = now
	if u.Product == "" {
		u.Product = "premium"
	}
	if u.Country == "" {
		u.Country = "US"
	}
	cleanEmail := strings.ToLower(strings.TrimSpace(u.Email))

	if r.db == nil {
		r.mu.Lock()
		defer r.mu.Unlock()
		if _, exists := r.memEmail[cleanEmail]; exists {
			return nil, errors.New("email already registered")
		}
		u.Email = cleanEmail
		r.memUsers[u.ID] = u
		r.memEmail[cleanEmail] = u.ID
		return u, nil
	}

	query := `
		INSERT INTO users (id, email, password_hash, display_name, avatar_url, bio, product, country, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, created_at, updated_at;
	`
	err := r.db.QueryRow(ctx, query,
		u.ID,
		cleanEmail,
		u.PasswordHash,
		u.DisplayName,
		u.AvatarURL,
		u.Bio,
		u.Product,
		u.Country,
		u.CreatedAt,
		u.UpdatedAt,
	).Scan(&u.ID, &u.CreatedAt, &u.UpdatedAt)

	if err != nil {
		return nil, err
	}
	return u, nil
}

func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	cleanEmail := strings.ToLower(strings.TrimSpace(email))
	if r.db == nil {
		r.mu.RLock()
		defer r.mu.RUnlock()
		id, ok := r.memEmail[cleanEmail]
		if !ok {
			return nil, nil
		}
		return r.memUsers[id], nil
	}

	query := `
		SELECT id, email, password_hash, display_name, avatar_url, bio, product, country, created_at, updated_at
		FROM users
		WHERE LOWER(email) = $1;
	`
	var u models.User
	err := r.db.QueryRow(ctx, query, cleanEmail).Scan(
		&u.ID,
		&u.Email,
		&u.PasswordHash,
		&u.DisplayName,
		&u.AvatarURL,
		&u.Bio,
		&u.Product,
		&u.Country,
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

func (r *UserRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	if r.db == nil {
		r.mu.RLock()
		defer r.mu.RUnlock()
		u, ok := r.memUsers[id]
		if !ok {
			return nil, nil
		}
		return u, nil
	}

	query := `
		SELECT id, email, password_hash, display_name, avatar_url, bio, product, country, created_at, updated_at
		FROM users
		WHERE id = $1;
	`
	var u models.User
	err := r.db.QueryRow(ctx, query, id).Scan(
		&u.ID,
		&u.Email,
		&u.PasswordHash,
		&u.DisplayName,
		&u.AvatarURL,
		&u.Bio,
		&u.Product,
		&u.Country,
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

func (r *UserRepository) UpdateUser(ctx context.Context, u *models.User) (*models.User, error) {
	u.UpdatedAt = time.Now()
	if r.db == nil {
		r.mu.Lock()
		defer r.mu.Unlock()
		r.memUsers[u.ID] = u
		return u, nil
	}

	query := `
		UPDATE users
		SET display_name = $1, avatar_url = $2, bio = $3, country = $4, updated_at = $5
		WHERE id = $6
		RETURNING updated_at;
	`
	err := r.db.QueryRow(ctx, query,
		u.DisplayName,
		u.AvatarURL,
		u.Bio,
		u.Country,
		u.UpdatedAt,
		u.ID,
	).Scan(&u.UpdatedAt)

	if err != nil {
		return nil, err
	}
	return u, nil
}

func (r *UserRepository) CreateSession(ctx context.Context, sessionID string, userID uuid.UUID, expiresAt time.Time) error {
	if r.db == nil {
		r.mu.Lock()
		defer r.mu.Unlock()
		r.memSess[sessionID] = models.Session{
			ID:        sessionID,
			UserID:    userID,
			CreatedAt: time.Now(),
			ExpiresAt: expiresAt,
		}
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
		r.mu.RLock()
		defer r.mu.RUnlock()
		sess, ok := r.memSess[sessionID]
		if !ok || time.Now().After(sess.ExpiresAt) {
			return nil, nil
		}
		u, uok := r.memUsers[sess.UserID]
		if !uok {
			return nil, nil
		}
		return u, nil
	}

	query := `
		SELECT u.id, u.email, u.password_hash, u.display_name, u.avatar_url, u.bio, u.product, u.country, u.created_at, u.updated_at
		FROM users u
		JOIN sessions s ON s.user_id = u.id
		WHERE s.id = $1 AND s.expires_at > CURRENT_TIMESTAMP;
	`
	var u models.User
	err := r.db.QueryRow(ctx, query, sessionID).Scan(
		&u.ID,
		&u.Email,
		&u.PasswordHash,
		&u.DisplayName,
		&u.AvatarURL,
		&u.Bio,
		&u.Product,
		&u.Country,
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
		r.mu.Lock()
		defer r.mu.Unlock()
		delete(r.memSess, sessionID)
		return nil
	}
	query := `DELETE FROM sessions WHERE id = $1;`
	_, err := r.db.Exec(ctx, query, sessionID)
	return err
}
