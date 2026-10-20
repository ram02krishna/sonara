package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/sonara/api/internal/config"
	"github.com/sonara/api/internal/provider"
	"github.com/sonara/api/internal/repository"
	"github.com/sonara/api/internal/service"
)

type AuthHandler struct {
	cfg         *config.Config
	authService *service.AuthService
	userRepo    *repository.UserRepository
	spotify     *provider.SpotifyProvider
}

func NewAuthHandler(
	cfg *config.Config,
	authService *service.AuthService,
	userRepo *repository.UserRepository,
	spotify *provider.SpotifyProvider,
) *AuthHandler {
	return &AuthHandler{
		cfg:         cfg,
		authService: authService,
		userRepo:    userRepo,
		spotify:     spotify,
	}
}

const spotifyScopes = "user-read-private user-read-email user-read-playback-state user-modify-playback-state user-read-currently-playing streaming user-read-recently-played user-top-read playlist-read-private playlist-modify-public playlist-modify-private user-library-read user-library-modify"

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	verifier, challenge, state, err := h.authService.GeneratePKCE()
	if err != nil {
		http.Error(w, "Failed to generate PKCE tokens", http.StatusInternalServerError)
		return
	}

	if err := h.authService.StorePKCEState(r.Context(), state, verifier); err != nil {
		http.Error(w, "Failed to store OAuth state", http.StatusInternalServerError)
		return
	}

	authURL := fmt.Sprintf(
		"https://accounts.spotify.com/authorize?response_type=code&client_id=%s&scope=%s&redirect_uri=%s&state=%s&code_challenge_method=S256&code_challenge=%s",
		url.QueryEscape(h.cfg.SpotifyClientID),
		url.QueryEscape(spotifyScopes),
		url.QueryEscape(h.cfg.SpotifyRedirectURI),
		url.QueryEscape(state),
		url.QueryEscape(challenge),
	)

	http.Redirect(w, r, authURL, http.StatusFound)
}

func (h *AuthHandler) Callback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")

	if code == "" || state == "" {
		http.Error(w, "Missing code or state in callback", http.StatusBadRequest)
		return
	}

	verifier, err := h.authService.GetAndClearPKCEState(r.Context(), state)
	if err != nil {
		http.Error(w, "Invalid OAuth state", http.StatusUnauthorized)
		return
	}

	tokens, err := h.authService.ExchangeCode(r.Context(), code, verifier)
	if err != nil {
		http.Error(w, fmt.Sprintf("Token exchange failed: %v", err), http.StatusBadRequest)
		return
	}

	// Fetch user profile from Spotify
	userProfile, err := h.spotify.GetProfile(r.Context(), tokens.AccessToken)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get Spotify profile: %v", err), http.StatusInternalServerError)
		return
	}

	sessionID, err := h.authService.SaveUserTokens(r.Context(), userProfile, tokens)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to create session: %v", err), http.StatusInternalServerError)
		return
	}

	// Set httpOnly session cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "sonara_session",
		Value:    sessionID,
		Path:     "/",
		MaxAge:   30 * 24 * 3600, // 30 days
		HttpOnly: true,
		Secure:   h.cfg.AppEnv == "production",
		SameSite: http.SameSiteLaxMode,
	})

	// Redirect back to Next.js frontend
	frontendURL := strings.Split(h.cfg.AllowedOrigins, ",")[0]
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}
	http.Redirect(w, r, frontendURL+"/", http.StatusFound)
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("sonara_session")
	if err == nil && cookie.Value != "" {
		_ = h.userRepo.DeleteSession(r.Context(), cookie.Value)
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "sonara_session",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
	})

	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{"message": "logged out"})
}

func (h *AuthHandler) Session(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("sonara_session")
	if err != nil || cookie.Value == "" {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"authenticated": false,
			"is_premium":    false,
		})
		return
	}

	user, err := h.userRepo.GetUserBySession(r.Context(), cookie.Value)
	if err != nil || user == nil {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"authenticated": false,
			"is_premium":    false,
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"authenticated": true,
		"is_premium":    user.Product == "premium",
		"user":          user,
	})
}
