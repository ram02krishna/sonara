package handler

import (
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/sonara/api/internal/config"
	"github.com/sonara/api/internal/models"
	"github.com/sonara/api/internal/service"
)

const sessionCookie = "sonara_session"

type AuthHandler struct {
	cfg         *config.Config
	authService *service.AuthService
}

func NewAuthHandler(cfg *config.Config, authService *service.AuthService) *AuthHandler {
	return &AuthHandler{cfg: cfg, authService: authService}
}

func (h *AuthHandler) setSessionCookie(w http.ResponseWriter, sessionID string) {
	http.SetCookie(w, &http.Cookie{
		Name: sessionCookie, Value: sessionID, Path: "/", MaxAge: 30 * 24 * 3600,
		HttpOnly: true, Secure: h.cfg.CookieSecure, SameSite: http.SameSiteLaxMode,
	})
}

type authRequest struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	DisplayName string `json:"display_name"`
}

// isGuest reports whether a profile was created with "Continue as guest".
func isGuest(u *models.User) bool { return strings.HasSuffix(u.Email, "@guest.sonara.local") }

type sessionBody struct {
	Authenticated bool         `json:"authenticated"`
	Guest         bool         `json:"guest"`
	User          *models.User `json:"user"`
}

func newSessionBody(u *models.User) sessionBody {
	if u == nil {
		return sessionBody{}
	}
	return sessionBody{Authenticated: true, Guest: isGuest(u), User: u}
}

func (h *AuthHandler) respond(w http.ResponseWriter, u *models.User, sessionID string) {
	h.setSessionCookie(w, sessionID)
	writeJSON(w, http.StatusOK, newSessionBody(u))
}

func (h *AuthHandler) Signup(w http.ResponseWriter, r *http.Request) {
	var req authRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10)).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "Invalid request body")
		return
	}
	user, sid, err := h.authService.Register(r.Context(), req.Email, req.Password, req.DisplayName)
	if err != nil {
		writeError(w, http.StatusBadRequest, "signup_failed", err.Error())
		return
	}
	h.respond(w, user, sid)
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req authRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10)).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "Invalid request body")
		return
	}
	user, sid, err := h.authService.Login(r.Context(), req.Email, req.Password)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid_credentials", err.Error())
		return
	}
	h.respond(w, user, sid)
}

func (h *AuthHandler) Guest(w http.ResponseWriter, r *http.Request) {
	var req authRequest
	_ = json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10)).Decode(&req)
	user, sid, err := h.authService.GuestLogin(r.Context(), req.DisplayName)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "guest_failed", err.Error())
		return
	}
	h.respond(w, user, sid)
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	if id := sessionIDFromRequest(r); id != "" {
		_ = h.authService.Logout(r.Context(), id)
	}
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Value: "", Path: "/", MaxAge: -1, HttpOnly: true})
	writeJSON(w, http.StatusOK, map[string]string{"message": "logged out"})
}

// Session returns the current user, or authenticated:false. It never invents a user.
func (h *AuthHandler) Session(w http.ResponseWriter, r *http.Request) {
	if id := sessionIDFromRequest(r); id != "" {
		if user, err := h.authService.GetUserBySession(r.Context(), id); err == nil && user != nil {
			writeJSON(w, http.StatusOK, newSessionBody(user))
			return
		}
	}
	writeJSON(w, http.StatusOK, sessionBody{})
}

func sessionIDFromRequest(r *http.Request) string {
	if c, err := r.Cookie(sessionCookie); err == nil && c.Value != "" {
		return c.Value
	}
	if hdr := r.Header.Get("Authorization"); strings.HasPrefix(hdr, "Bearer ") {
		return strings.TrimSpace(hdr[7:])
	}
	return ""
}

// RateLimit is a small per-IP limiter for the credential endpoints (brute-force protection).
func RateLimit(max int, window time.Duration) func(http.Handler) http.Handler {
	type bucket struct {
		count int
		reset time.Time
	}
	var mu sync.Mutex
	buckets := map[string]*bucket{}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := r.RemoteAddr
			if i := strings.LastIndex(ip, ":"); i > 0 {
				ip = ip[:i]
			}
			mu.Lock()
			b := buckets[ip]
			if b == nil || time.Now().After(b.reset) {
				b = &bucket{reset: time.Now().Add(window)}
				buckets[ip] = b
			}
			b.count++
			over := b.count > max
			if len(buckets) > 5000 {
				buckets = map[string]*bucket{}
			}
			mu.Unlock()
			if over {
				w.Header().Set("Retry-After", "60")
				writeError(w, http.StatusTooManyRequests, "rate_limited", "Too many attempts. Please wait a minute and try again.")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
