package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"

	"github.com/sonara/api/internal/config"
	"github.com/sonara/api/internal/models"
	"github.com/sonara/api/internal/repository"
)

type AuthService struct {
	cfg      *config.Config
	userRepo *repository.UserRepository
	rdb      *redis.Client
}

func NewAuthService(cfg *config.Config, userRepo *repository.UserRepository, rdb *redis.Client) *AuthService {
	return &AuthService{
		cfg:      cfg,
		userRepo: userRepo,
		rdb:      rdb,
	}
}

func generateSessionID() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// Register creates a new Sonara user account and begins a 30-day session
func (s *AuthService) Register(ctx context.Context, email, password, displayName string) (*models.User, string, error) {
	cleanEmail := strings.ToLower(strings.TrimSpace(email))
	cleanName := strings.TrimSpace(displayName)
	if cleanEmail == "" {
		return nil, "", errors.New("email is required")
	}
	if len(password) < 6 {
		return nil, "", errors.New("password must be at least 6 characters")
	}
	if cleanName == "" {
		cleanName = strings.Split(cleanEmail, "@")[0]
	}

	existing, _ := s.userRepo.GetByEmail(ctx, cleanEmail)
	if existing != nil {
		return nil, "", errors.New("an account with this email already exists")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, "", fmt.Errorf("failed to hash password: %w", err)
	}

	user := &models.User{
		ID:           uuid.New(),
		Email:        cleanEmail,
		PasswordHash: string(hash),
		DisplayName:  cleanName,
		Product:      "premium",
		Country:      "US",
	}

	saved, err := s.userRepo.CreateUser(ctx, user)
	if err != nil {
		return nil, "", err
	}

	sessionID, err := s.createSession(ctx, saved.ID)
	if err != nil {
		return nil, "", err
	}

	return saved, sessionID, nil
}

// Login verifies credentials and begins a 30-day session
func (s *AuthService) Login(ctx context.Context, email, password string) (*models.User, string, error) {
	cleanEmail := strings.ToLower(strings.TrimSpace(email))
	if cleanEmail == "" || password == "" {
		return nil, "", errors.New("email and password are required")
	}

	user, err := s.userRepo.GetByEmail(ctx, cleanEmail)
	if err != nil || user == nil {
		return nil, "", errors.New("invalid email or password")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, "", errors.New("invalid email or password")
	}

	sessionID, err := s.createSession(ctx, user.ID)
	if err != nil {
		return nil, "", err
	}

	return user, sessionID, nil
}

// GuestLogin creates or retrieves an instant listener profile
func (s *AuthService) GuestLogin(ctx context.Context, displayName string) (*models.User, string, error) {
	cleanName := strings.TrimSpace(displayName)
	if cleanName == "" {
		cleanName = "Sonara Listener"
	}

	guestID := uuid.New()
	guestEmail := fmt.Sprintf("guest-%s@sonara.app", guestID.String()[:8])

	user := &models.User{
		ID:           guestID,
		Email:        guestEmail,
		DisplayName:  cleanName,
		Bio:          "Studio Master Guest",
		Product:      "premium",
		Country:      "US",
		PasswordHash: "",
	}

	saved, err := s.userRepo.CreateUser(ctx, user)
	if err != nil {
		// Fallback to default user
		defaultID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
		saved, _ = s.userRepo.GetByID(ctx, defaultID)
		if saved == nil {
			saved = user
		}
	}

	sessionID, err := s.createSession(ctx, saved.ID)
	if err != nil {
		return nil, "", err
	}

	return saved, sessionID, nil
}

func (s *AuthService) createSession(ctx context.Context, userID uuid.UUID) (string, error) {
	sessionID, err := generateSessionID()
	if err != nil {
		return "", err
	}
	expiresAt := time.Now().Add(30 * 24 * time.Hour)

	if err := s.userRepo.CreateSession(ctx, sessionID, userID, expiresAt); err != nil {
		return "", err
	}

	if s.rdb != nil {
		_ = s.rdb.Set(ctx, fmt.Sprintf("session:%s", sessionID), userID.String(), 30*24*time.Hour).Err()
	}

	return sessionID, nil
}

func (s *AuthService) Logout(ctx context.Context, sessionID string) error {
	if s.rdb != nil {
		_ = s.rdb.Del(ctx, fmt.Sprintf("session:%s", sessionID)).Err()
	}
	return s.userRepo.DeleteSession(ctx, sessionID)
}

func (s *AuthService) GetUserBySession(ctx context.Context, sessionID string) (*models.User, error) {
	return s.userRepo.GetUserBySession(ctx, sessionID)
}
