package handler

import (
	"encoding/json"
	"net/http"

	"github.com/sonara/api/internal/config"
	"github.com/sonara/api/internal/service"
)

type AuthHandler struct {
	cfg         *config.Config
	authService *service.AuthService
}

func NewAuthHandler(cfg *config.Config, authService *service.AuthService) *AuthHandler {
	return &AuthHandler{
		cfg:         cfg,
		authService: authService,
	}
}

func (h *AuthHandler) setSessionCookie(w http.ResponseWriter, sessionID string) {
	http.SetCookie(w, &http.Cookie{
		Name:     "sonara_session",
		Value:    sessionID,
		Path:     "/",
		MaxAge:   30 * 24 * 3600, // 30 days
		HttpOnly: true,
		Secure:   h.cfg.AppEnv == "production",
		SameSite: http.SameSiteLaxMode,
	})
}

type authRequest struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	DisplayName string `json:"display_name"`
}

// Signup creates a new native Sonara account
func (h *AuthHandler) Signup(w http.ResponseWriter, r *http.Request) {
	var req authRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "Invalid request body")
		return
	}

	user, sessionID, err := h.authService.Register(r.Context(), req.Email, req.Password, req.DisplayName)
	if err != nil {
		writeError(w, http.StatusBadRequest, "signup_failed", err.Error())
		return
	}

	h.setSessionCookie(w, sessionID)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"authenticated": true,
		"user":          user,
		"token":         sessionID,
		"session_id":    sessionID,
	})
}

// Login authenticates with Sonara credentials
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req authRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "Invalid request body")
		return
	}

	user, sessionID, err := h.authService.Login(r.Context(), req.Email, req.Password)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid_credentials", err.Error())
		return
	}

	h.setSessionCookie(w, sessionID)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"authenticated": true,
		"user":          user,
		"token":         sessionID,
		"session_id":    sessionID,
	})
}

// Guest creates an instant listener profile with 1 click
func (h *AuthHandler) Guest(w http.ResponseWriter, r *http.Request) {
	var req authRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	user, sessionID, err := h.authService.GuestLogin(r.Context(), req.DisplayName)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "guest_failed", err.Error())
		return
	}

	h.setSessionCookie(w, sessionID)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"authenticated": true,
		"user":          user,
		"token":         sessionID,
		"session_id":    sessionID,
	})
}

// Logout clears the session and cookie
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("sonara_session")
	if err == nil && cookie.Value != "" {
		_ = h.authService.Logout(r.Context(), cookie.Value)
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "sonara_session",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
	})

	writeJSON(w, http.StatusOK, map[string]string{"message": "logged out"})
}

// Session returns the current authenticated Sonara user
func (h *AuthHandler) Session(w http.ResponseWriter, r *http.Request) {
	var sessionID string
	if cookie, err := r.Cookie("sonara_session"); err == nil && cookie.Value != "" {
		sessionID = cookie.Value
	}
	if sessionID == "" {
		authHdr := r.Header.Get("Authorization")
		if len(authHdr) > 7 && authHdr[:7] == "Bearer " {
			sessionID = authHdr[7:]
		}
	}

	if sessionID != "" {
		user, err := h.authService.GetUserBySession(r.Context(), sessionID)
		if err == nil && user != nil {
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"authenticated": true,
				"is_premium":    true,
				"user":          user,
				"token":         sessionID,
				"session_id":    sessionID,
			})
			return
		}
	}

	// Unauthenticated
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"authenticated": false,
		"user":          nil,
	})
}
