package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/sonara/api/internal/models"
)

func (h *MusicHandler) GetMe(w http.ResponseWriter, r *http.Request) {
	user, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	writeJSON(w, http.StatusOK, newSessionBody(user))
}

func (h *MusicHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	user, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	var body struct {
		DisplayName string `json:"display_name"`
		Country     string `json:"country"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4<<10)).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "Invalid profile.")
		return
	}
	updated, err := h.Auth.UpdateProfile(r.Context(), user, body.DisplayName, body.Country)
	if err != nil {
		writeError(w, http.StatusBadRequest, "profile_invalid", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, newSessionBody(updated))
}

func (h *MusicHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	user, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	var body struct {
		Current string `json:"current_password"`
		New     string `json:"new_password"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4<<10)).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "Invalid request.")
		return
	}
	if err := h.Auth.ChangePassword(r.Context(), user, body.Current, body.New); err != nil {
		writeError(w, http.StatusBadRequest, "password_invalid", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// UpgradeGuest attaches an email and password to a guest profile so it can be signed into again.
func (h *MusicHandler) UpgradeGuest(w http.ResponseWriter, r *http.Request) {
	user, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	if !isGuest(user) {
		// A full account already has credentials; changing them goes through /me/password.
		writeError(w, http.StatusBadRequest, "upgrade_failed", "This account already has an email and password.")
		return
	}
	var body authRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4<<10)).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "Invalid request.")
		return
	}
	if err := h.Auth.UpgradeGuest(r.Context(), user, body.Email, body.Password); err != nil {
		writeError(w, http.StatusBadRequest, "upgrade_failed", err.Error())
		return
	}
	if updated, err := h.Auth.GetUserBySession(r.Context(), sessionIDFromRequest(r)); err == nil && updated != nil {
		user = updated
	}
	writeJSON(w, http.StatusOK, newSessionBody(user))
}

// DeleteAccount permanently removes the account and all of its data.
func (h *MusicHandler) DeleteAccount(w http.ResponseWriter, r *http.Request) {
	user, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	if r.URL.Query().Get("confirm") != "yes" {
		writeError(w, http.StatusBadRequest, "confirmation_required", "Add ?confirm=yes to permanently delete your account.")
		return
	}
	if err := h.Auth.DeleteAccount(r.Context(), user); err != nil {
		writeError(w, http.StatusInternalServerError, "delete_failed", "Could not delete the account.")
		return
	}
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Value: "", Path: "/", MaxAge: -1, HttpOnly: true})
	writeJSON(w, http.StatusOK, map[string]bool{"deleted": true})
}

func (h *MusicHandler) ClearHistory(w http.ResponseWriter, r *http.Request) {
	user, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	if err := h.History.Clear(r.Context(), user.ID); err != nil {
		dbError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// ExportData returns everything Sonara stores about the user as a JSON download.
func (h *MusicHandler) ExportData(w http.ResponseWriter, r *http.Request) {
	user, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	prefs, _ := h.Prefs.Get(ctx, user.ID)
	liked, _ := h.Library.GetSavedTracks(ctx, user.ID, 100)
	playlists, _ := h.Playlists.List(ctx, user.ID)
	full := make([]*models.UserPlaylist, 0, len(playlists))
	for _, p := range playlists {
		if g, err := h.Playlists.Get(ctx, user.ID, p.ID); err == nil {
			full = append(full, g)
		}
	}
	history, _ := h.History.Recent(ctx, user.ID, 100)
	following, _ := h.Collection.List(ctx, user.ID, "artist", 100)
	albums, _ := h.Collection.List(ctx, user.ID, "album", 100)

	w.Header().Set("Content-Disposition", `attachment; filename="sonara-data.json"`)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"exported_at": time.Now().UTC(), "account": user, "preferences": prefs, "liked_songs": liked,
		"playlists": full, "recently_played": history, "followed_artists": following, "saved_albums": albums,
	})
}
