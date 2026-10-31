package repository

import (
	"context"
	"errors"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/sonara/api/internal/models"
	"gorm.io/gorm"
)

// dbUser is the GORM-mapped struct for the users table.
type dbUser struct {
	ID           uuid.UUID `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()"`
	Email        string    `gorm:"column:email;unique;size:255;not null"`
	PasswordHash string    `gorm:"column:password_hash;size:255;not null;default:''"`
	DisplayName  string    `gorm:"column:display_name;size:255;not null"`
	AvatarURL    string    `gorm:"column:avatar_url;default:''"`
	Bio          string    `gorm:"column:bio;default:''"`
	Product      string    `gorm:"column:product;size:64;default:'premium'"`
	Country      string    `gorm:"column:country;size:8;default:'US'"`
	CreatedAt    time.Time `gorm:"column:created_at;autoCreateTime"`
	UpdatedAt    time.Time `gorm:"column:updated_at;autoUpdateTime"`
}

func (dbUser) TableName() string { return "users" }

// dbSession is the GORM-mapped struct for the sessions table.
type dbSession struct {
	ID        string    `gorm:"column:id;size:128;primaryKey"`
	UserID    uuid.UUID `gorm:"column:user_id;type:uuid;not null;index:idx_sessions_user_id"`
	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime"`
	ExpiresAt time.Time `gorm:"column:expires_at;not null"`
}

func (dbSession) TableName() string { return "sessions" }

func toModelUser(u dbUser) *models.User {
	return &models.User{
		ID:           u.ID,
		Email:        u.Email,
		PasswordHash: u.PasswordHash,
		DisplayName:  u.DisplayName,
		AvatarURL:    u.AvatarURL,
		Bio:          u.Bio,
		Product:      u.Product,
		Country:      u.Country,
		CreatedAt:    u.CreatedAt,
		UpdatedAt:    u.UpdatedAt,
	}
}

type UserRepository struct {
	db       *gorm.DB
	mu       sync.RWMutex
	memUsers map[uuid.UUID]*models.User
	memEmail map[string]uuid.UUID
	memSess  map[string]models.Session
}

func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{
		db:       db,
		memUsers: make(map[uuid.UUID]*models.User),
		memEmail: make(map[string]uuid.UUID),
		memSess:  make(map[string]models.Session),
	}
}

// EnsureSchema auto-migrates the users and sessions tables.
func (r *UserRepository) EnsureSchema(_ context.Context) error {
	if r.db == nil {
		return nil
	}
	// Enable uuid-ossp and pgcrypto extensions.
	r.db.Exec(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`)
	r.db.Exec(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`)

	if err := r.db.AutoMigrate(&dbUser{}, &dbSession{}); err != nil {
		return err
	}
	return ensureCascadeFK(r.db, "sessions", "user_id", "users")
}

func (r *UserRepository) CreateUser(_ context.Context, u *models.User) (*models.User, error) {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	cleanEmail := strings.ToLower(strings.TrimSpace(u.Email))

	if r.db == nil {
		r.mu.Lock()
		defer r.mu.Unlock()
		if _, exists := r.memEmail[cleanEmail]; exists {
			return nil, ErrEmailTaken
		}
		u.Email = cleanEmail
		now := time.Now()
		u.CreatedAt = now
		u.UpdatedAt = now
		r.memUsers[u.ID] = u
		r.memEmail[cleanEmail] = u.ID
		return u, nil
	}

	row := dbUser{
		ID:           u.ID,
		Email:        cleanEmail,
		PasswordHash: u.PasswordHash,
		DisplayName:  u.DisplayName,
		AvatarURL:    u.AvatarURL,
		Bio:          u.Bio,
		Product:      u.Product,
		Country:      u.Country,
	}
	if result := r.db.Create(&row); result.Error != nil {
		if errors.Is(result.Error, gorm.ErrDuplicatedKey) {
			return nil, ErrEmailTaken
		}
		return nil, result.Error
	}
	return toModelUser(row), nil
}

func (r *UserRepository) GetByEmail(_ context.Context, email string) (*models.User, error) {
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

	var row dbUser
	// Emails are always stored lower-cased, so a plain equality lets Postgres use the unique index.
	result := r.db.Where("email = ?", cleanEmail).First(&row)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if result.Error != nil {
		return nil, result.Error
	}
	return toModelUser(row), nil
}

func (r *UserRepository) GetByID(_ context.Context, id uuid.UUID) (*models.User, error) {
	if r.db == nil {
		r.mu.RLock()
		defer r.mu.RUnlock()
		u, ok := r.memUsers[id]
		if !ok {
			return nil, nil
		}
		return u, nil
	}

	var row dbUser
	result := r.db.First(&row, "id = ?", id)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if result.Error != nil {
		return nil, result.Error
	}
	return toModelUser(row), nil
}

func (r *UserRepository) UpdateUser(_ context.Context, u *models.User) (*models.User, error) {
	if r.db == nil {
		r.mu.Lock()
		defer r.mu.Unlock()
		u.UpdatedAt = time.Now()
		r.memUsers[u.ID] = u
		return u, nil
	}

	result := r.db.Model(&dbUser{}).Where("id = ?", u.ID).Updates(map[string]interface{}{
		"display_name": u.DisplayName,
		"avatar_url":   u.AvatarURL,
		"bio":          u.Bio,
		"country":      u.Country,
		"updated_at":   time.Now(),
	})
	if result.Error != nil {
		return nil, result.Error
	}
	return u, nil
}

func (r *UserRepository) CreateSession(_ context.Context, sessionID string, userID uuid.UUID, expiresAt time.Time) error {
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

	sess := dbSession{ID: sessionID, UserID: userID, ExpiresAt: expiresAt}
	return r.db.Save(&sess).Error
}

func (r *UserRepository) GetUserBySession(_ context.Context, sessionID string) (*models.User, error) {
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

	var sess dbSession
	if err := r.db.Where("id = ? AND expires_at > ?", sessionID, time.Now()).First(&sess).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	var row dbUser
	if err := r.db.First(&row, "id = ?", sess.UserID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return toModelUser(row), nil
}

func (r *UserRepository) DeleteSession(_ context.Context, sessionID string) error {
	if r.db == nil {
		r.mu.Lock()
		defer r.mu.Unlock()
		delete(r.memSess, sessionID)
		return nil
	}
	return r.db.Delete(&dbSession{}, "id = ?", sessionID).Error
}

// SetPassword stores a new bcrypt hash for the user.
func (r *UserRepository) SetPassword(_ context.Context, id uuid.UUID, hash string) error {
	if r.db == nil {
		r.mu.Lock()
		defer r.mu.Unlock()
		if u, ok := r.memUsers[id]; ok {
			u.PasswordHash = hash
		}
		return nil
	}
	return r.db.Model(&dbUser{}).Where("id = ?", id).Updates(map[string]interface{}{
		"password_hash": hash,
		"updated_at":    time.Now(),
	}).Error
}

// DeleteUser permanently removes the account and everything it owns. The foreign keys
// created in EnsureSchema cascade too, but the explicit transaction guarantees the data
// is gone even on databases where a constraint could not be added.
func (r *UserRepository) DeleteUser(_ context.Context, id uuid.UUID) error {
	if r.db == nil {
		r.mu.Lock()
		defer r.mu.Unlock()
		if u, ok := r.memUsers[id]; ok {
			delete(r.memEmail, u.Email)
			delete(r.memUsers, id)
		}
		for sid, sess := range r.memSess {
			if sess.UserID == id {
				delete(r.memSess, sid)
			}
		}
		return nil
	}
	return r.db.Transaction(func(tx *gorm.DB) error {
		for _, stmt := range []string{
			`DELETE FROM sonara_playlist_tracks WHERE playlist_id IN (SELECT id FROM sonara_playlists WHERE user_id = ?)`,
			`DELETE FROM sonara_playlists WHERE user_id = ?`,
			`DELETE FROM user_collection WHERE user_id = ?`,
			`DELETE FROM user_library WHERE user_id = ?`,
			`DELETE FROM user_preferences WHERE user_id = ?`,
			`DELETE FROM play_history WHERE user_id = ?`,
			`DELETE FROM sessions WHERE user_id = ?`,
		} {
			if err := tx.Exec(stmt, id).Error; err != nil {
				return err
			}
		}
		return tx.Delete(&dbUser{}, "id = ?", id).Error
	})
}

// AttachCredentials gives a guest profile a real email and password.
func (r *UserRepository) AttachCredentials(_ context.Context, id uuid.UUID, email, hash string) error {
	if r.db == nil {
		r.mu.Lock()
		defer r.mu.Unlock()
		if other, taken := r.memEmail[email]; taken && other != id {
			return ErrEmailTaken
		}
		if u, ok := r.memUsers[id]; ok {
			delete(r.memEmail, u.Email)
			u.Email, u.PasswordHash = email, hash
			r.memEmail[email] = id
		}
		return nil
	}
	err := r.db.Model(&dbUser{}).Where("id = ?", id).Updates(map[string]interface{}{
		"email":         email,
		"password_hash": hash,
		"updated_at":    time.Now(),
	}).Error
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return ErrEmailTaken
	}
	return err
}
