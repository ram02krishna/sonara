package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/sonara/api/internal/config"
	"github.com/sonara/api/internal/crypto"
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

// GeneratePKCE generates code_verifier, code_challenge (S256), and state
func (s *AuthService) GeneratePKCE() (verifier, challenge, state string, err error) {
	// 64 random bytes for verifier
	rawVerifier := make([]byte, 64)
	if _, err := io.ReadFull(rand.Reader, rawVerifier); err != nil {
		return "", "", "", err
	}
	verifier = base64.RawURLEncoding.EncodeToString(rawVerifier)

	// SHA256 of verifier
	h := sha256.Sum256([]byte(verifier))
	challenge = base64.RawURLEncoding.EncodeToString(h[:])

	// State
	rawState := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, rawState); err != nil {
		return "", "", "", err
	}
	state = base64.RawURLEncoding.EncodeToString(rawState)

	return verifier, challenge, state, nil
}

// StorePKCEState stores state -> verifier in Redis with 10 min TTL
func (s *AuthService) StorePKCEState(ctx context.Context, state, verifier string) error {
	if s.rdb == nil {
		return nil
	}
	key := fmt.Sprintf("oauth:state:%s", state)
	return s.rdb.Set(ctx, key, verifier, 10*time.Minute).Err()
}

// GetAndClearPKCEState validates state and retrieves verifier
func (s *AuthService) GetAndClearPKCEState(ctx context.Context, state string) (string, error) {
	if s.rdb == nil {
		return "mock-verifier", nil
	}
	key := fmt.Sprintf("oauth:state:%s", state)
	verifier, err := s.rdb.Get(ctx, key).Result()
	if err != nil {
		return "", fmt.Errorf("invalid or expired oauth state")
	}
	s.rdb.Del(ctx, key)
	return verifier, nil
}

type tokenResponse struct {
	AccessToken  string `json:"access_token"`
	TokenType    string `json:"token_type"`
	Scope        string `json:"scope"`
	ExpiresIn    int    `json:"expires_in"`
	RefreshToken string `json:"refresh_token"`
}

// ExchangeCode exchanges auth code + code_verifier for Spotify tokens
func (s *AuthService) ExchangeCode(ctx context.Context, code, verifier string) (*tokenResponse, error) {
	data := url.Values{}
	data.Set("grant_type", "authorization_code")
	data.Set("code", code)
	data.Set("redirect_uri", s.cfg.SpotifyRedirectURI)
	data.Set("client_id", s.cfg.SpotifyClientID)
	data.Set("code_verifier", verifier)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://accounts.spotify.com/api/token", strings.NewReader(data.Encode()))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	// If client secret is configured, send Basic Auth header
	if s.cfg.SpotifyClientSecret != "" {
		auth := base64.StdEncoding.EncodeToString([]byte(fmt.Sprintf("%s:%s", s.cfg.SpotifyClientID, s.cfg.SpotifyClientSecret)))
		req.Header.Set("Authorization", "Basic "+auth)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("spotify token exchange failed (status %d): %s", resp.StatusCode, string(body))
	}

	var tokens tokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokens); err != nil {
		return nil, err
	}

	return &tokens, nil
}

// SaveUserTokens encrypts tokens with AES-256 GCM and creates user session
func (s *AuthService) SaveUserTokens(ctx context.Context, user *models.User, tokens *tokenResponse) (string, error) {
	encAccess, err := crypto.Encrypt([]byte(tokens.AccessToken), s.cfg.TokenEncryptionKey)
	if err != nil {
		return "", err
	}
	encRefresh, err := crypto.Encrypt([]byte(tokens.RefreshToken), s.cfg.TokenEncryptionKey)
	if err != nil {
		return "", err
	}

	user.EncryptedAccessToken = encAccess
	user.EncryptedRefreshToken = encRefresh
	user.TokenExpiresAt = time.Now().Add(time.Duration(tokens.ExpiresIn) * time.Second)

	savedUser, err := s.userRepo.UpsertUser(ctx, user)
	if err != nil {
		return "", err
	}

	// Create session (valid for 30 days)
	sessionID := uuid.New().String()
	expiresAt := time.Now().Add(30 * 24 * time.Hour)

	if err := s.userRepo.CreateSession(ctx, sessionID, savedUser.ID, expiresAt); err != nil {
		return "", err
	}

	// Cache session in Redis for instant lookups
	if s.rdb != nil {
		s.rdb.Set(ctx, fmt.Sprintf("session:%s", sessionID), savedUser.ID.String(), 30*24*time.Hour)
	}

	return sessionID, nil
}

// GetValidAccessToken returns a valid decrypted token, automatically refreshing if expired
func (s *AuthService) GetValidAccessToken(ctx context.Context, user *models.User) (string, error) {
	// If token has at least 2 minutes remaining, return it directly
	if time.Until(user.TokenExpiresAt) > 2*time.Minute {
		plain, err := crypto.Decrypt(user.EncryptedAccessToken, s.cfg.TokenEncryptionKey)
		if err == nil {
			return string(plain), nil
		}
	}

	// Decrypt refresh token
	refreshBytes, err := crypto.Decrypt(user.EncryptedRefreshToken, s.cfg.TokenEncryptionKey)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt refresh token: %w", err)
	}

	// Request refreshed token from Spotify
	data := url.Values{}
	data.Set("grant_type", "refresh_token")
	data.Set("refresh_token", string(refreshBytes))
	data.Set("client_id", s.cfg.SpotifyClientID)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://accounts.spotify.com/api/token", strings.NewReader(data.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	if s.cfg.SpotifyClientSecret != "" {
		auth := base64.StdEncoding.EncodeToString([]byte(fmt.Sprintf("%s:%s", s.cfg.SpotifyClientID, s.cfg.SpotifyClientSecret)))
		req.Header.Set("Authorization", "Basic "+auth)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("token refresh failed with status %d", resp.StatusCode)
	}

	var newTokens tokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&newTokens); err != nil {
		return "", err
	}

	// Encrypt and persist new access token
	encAccess, err := crypto.Encrypt([]byte(newTokens.AccessToken), s.cfg.TokenEncryptionKey)
	if err != nil {
		return "", err
	}

	user.EncryptedAccessToken = encAccess
	user.TokenExpiresAt = time.Now().Add(time.Duration(newTokens.ExpiresIn) * time.Second)

	// If Spotify returned a new refresh token, update it as well
	if newTokens.RefreshToken != "" {
		encRefresh, err := crypto.Encrypt([]byte(newTokens.RefreshToken), s.cfg.TokenEncryptionKey)
		if err == nil {
			user.EncryptedRefreshToken = encRefresh
		}
	}

	_, _ = s.userRepo.UpsertUser(ctx, user)

	return newTokens.AccessToken, nil
}
