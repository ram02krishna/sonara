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

// checkPassword enforces the length rules (bcrypt silently cannot hash more than 72 bytes).
func checkPassword(p string) error {
	if len(p) < 8 {
		return errors.New("password must be at least 8 characters")
	}
	if len(p) > 72 {
		return errors.New("password must be at most 72 bytes")
	}
	return nil
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
	if !strings.Contains(cleanEmail, "@") || len(cleanEmail) > 254 {
		return nil, "", errors.New("enter a valid email address")
	}
	if err := checkPassword(password); err != nil {
		return nil, "", err
	}
	if cleanName == "" {
		cleanName = strings.Split(cleanEmail, "@")[0]
	}

	existing, err := s.userRepo.GetByEmail(ctx, cleanEmail)
	if err != nil {
		return nil, "", errors.New("could not create your account, please try again")
	}
	if existing != nil {
		return nil, "", repository.ErrEmailTaken
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
		Country:      s.cfg.SpotifyDefaultMarket,
	}

	saved, err := s.userRepo.CreateUser(ctx, user)
	if err != nil {
		if errors.Is(err, repository.ErrEmailTaken) {
			return nil, "", err
		}
		return nil, "", errors.New("could not create your account, please try again")
	}

	sessionID, err := s.createSession(ctx, saved.ID)
	if err != nil {
		return nil, "", err
	}

	return saved, sessionID, nil
}

// dummyHash is compared against when the email is unknown so that "no such user" takes as
// long as "wrong password" and the endpoint cannot be used to enumerate accounts.
var dummyHash, _ = bcrypt.GenerateFromPassword([]byte("sonara-dummy-password"), bcrypt.DefaultCost)

// Login verifies credentials and begins a 30-day session
func (s *AuthService) Login(ctx context.Context, email, password string) (*models.User, string, error) {
	cleanEmail := strings.ToLower(strings.TrimSpace(email))
	if cleanEmail == "" || password == "" {
		return nil, "", errors.New("email and password are required")
	}

	user, err := s.userRepo.GetByEmail(ctx, cleanEmail)
	if err != nil || user == nil {
		_ = bcrypt.CompareHashAndPassword(dummyHash, []byte(password))
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

// GuestLogin creates a brand-new, isolated listener profile (no email or password).
// Each guest gets their own data; there is no shared fallback account.
func (s *AuthService) GuestLogin(ctx context.Context, displayName string) (*models.User, string, error) {
	cleanName := strings.TrimSpace(displayName)
	if cleanName == "" {
		cleanName = "Listener"
	}
	guestID := uuid.New()
	user := &models.User{
		ID:          guestID,
		Email:       fmt.Sprintf("guest-%s@guest.sonara.local", guestID.String()),
		DisplayName: cleanName,
		Country:     s.cfg.SpotifyDefaultMarket,
	}
	saved, err := s.userRepo.CreateUser(ctx, user)
	if err != nil {
		return nil, "", fmt.Errorf("could not create guest profile: %w", err)
	}
	sessionID, err := s.createSession(ctx, saved.ID)
	if err != nil {
		return nil, "", err
	}
	return saved, sessionID, nil
}

// UpdateProfile changes the display name and/or region.
func (s *AuthService) UpdateProfile(ctx context.Context, user *models.User, name, country string) (*models.User, error) {
	if n := strings.TrimSpace(name); n != "" {
		if len(n) > 60 {
			return nil, errors.New("name is too long")
		}
		user.DisplayName = n
	}
	if c := strings.ToUpper(strings.TrimSpace(country)); len(c) == 2 {
		user.Country = c
	}
	return s.userRepo.UpdateUser(ctx, user)
}

// ChangePassword verifies the current password (when the account has one) and sets a new one.
func (s *AuthService) ChangePassword(ctx context.Context, user *models.User, current, next string) error {
	if err := checkPassword(next); err != nil {
		return err
	}
	if user.PasswordHash != "" {
		if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(current)); err != nil {
			return errors.New("current password is incorrect")
		}
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(next), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	return s.userRepo.SetPassword(ctx, user.ID, string(hash))
}

// DeleteAccount permanently deletes the user and everything they own.
func (s *AuthService) DeleteAccount(ctx context.Context, user *models.User) error {
	return s.userRepo.DeleteUser(ctx, user.ID)
}

// UpgradeGuest turns a guest profile into a full account by attaching an email and password.
func (s *AuthService) UpgradeGuest(ctx context.Context, user *models.User, email, password string) error {
	cleanEmail := strings.ToLower(strings.TrimSpace(email))
	if !strings.Contains(cleanEmail, "@") {
		return errors.New("enter a valid email address")
	}
	if err := checkPassword(password); err != nil {
		return err
	}
	if existing, _ := s.userRepo.GetByEmail(ctx, cleanEmail); existing != nil && existing.ID != user.ID {
		return errors.New("an account with this email already exists")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	if err := s.userRepo.AttachCredentials(ctx, user.ID, cleanEmail, string(hash)); err != nil {
		if errors.Is(err, repository.ErrEmailTaken) {
			return err
		}
		return errors.New("could not upgrade your profile, please try again")
	}
	return nil
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
