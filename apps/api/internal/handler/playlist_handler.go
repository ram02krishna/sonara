package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/sonara/api/internal/models"
	"github.com/sonara/api/internal/repository"
)

func playlistID(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "Playlist not found.")
		return uuid.Nil, false
	}
	return id, true
}

func playlistError(w http.ResponseWriter, err error) {
	if errors.Is(err, repository.ErrPlaylistNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "Playlist not found.")
		return
	}
	if errors.Is(err, repository.ErrInvalidPosition) {
		writeError(w, http.StatusBadRequest, "bad_request", "That position is outside the playlist.")
		return
	}
	dbError(w, err)
}

type playlistBody struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Tracks      []models.Track `json:"tracks"`
}

func cleanPlaylist(b playlistBody) (string, string, bool) {
	name := strings.TrimSpace(b.Name)
	// Count characters, not bytes: the column limit is in characters and names may be non-ASCII.
	if name == "" || utf8.RuneCountInString(name) > 120 {
		return "", "", false
	}
	desc := strings.TrimSpace(b.Description)
	if r := []rune(desc); len(r) > 500 {
		// Cutting at a byte offset could split a multi-byte character and make Postgres reject the row.
		desc = string(r[:500])
	}
	return name, desc, true
}

func (h *MusicHandler) ListPlaylists(w http.ResponseWriter, r *http.Request) {
	user, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	items, err := h.Playlists.List(r.Context(), user.ID)
	if err != nil {
		dbError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"items": items})
}

func (h *MusicHandler) CreatePlaylist(w http.ResponseWriter, r *http.Request) {
	user, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	var body playlistBody
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 256<<10)).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "Invalid playlist.")
		return
	}
	name, desc, valid := cleanPlaylist(body)
	if !valid {
		writeError(w, http.StatusBadRequest, "bad_request", "Give your playlist a name (up to 120 characters).")
		return
	}
	p, err := h.Playlists.Create(r.Context(), user.ID, name, desc)
	if err != nil {
		dbError(w, err)
		return
	}
	if len(body.Tracks) > 0 {
		_, _ = h.Playlists.AddTracks(r.Context(), user.ID, p.ID, body.Tracks)
		if full, err := h.Playlists.Get(r.Context(), user.ID, p.ID); err == nil {
			p = full
		}
	}
	writeJSON(w, http.StatusCreated, p)
}

func (h *MusicHandler) GetPlaylist(w http.ResponseWriter, r *http.Request) {
	user, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	id, ok := playlistID(w, r)
	if !ok {
		return
	}
	p, err := h.Playlists.Get(r.Context(), user.ID, id)
	if err != nil {
		playlistError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (h *MusicHandler) UpdatePlaylist(w http.ResponseWriter, r *http.Request) {
	user, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	id, ok := playlistID(w, r)
	if !ok {
		return
	}
	var body playlistBody
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10)).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "Invalid playlist.")
		return
	}
	name, desc, valid := cleanPlaylist(body)
	if !valid {
		writeError(w, http.StatusBadRequest, "bad_request", "Give your playlist a name (up to 120 characters).")
		return
	}
	if err := h.Playlists.Update(r.Context(), user.ID, id, name, desc); err != nil {
		playlistError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *MusicHandler) DeletePlaylist(w http.ResponseWriter, r *http.Request) {
	user, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	id, ok := playlistID(w, r)
	if !ok {
		return
	}
	if err := h.Playlists.Delete(r.Context(), user.ID, id); err != nil {
		playlistError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *MusicHandler) AddPlaylistTracks(w http.ResponseWriter, r *http.Request) {
	user, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	id, ok := playlistID(w, r)
	if !ok {
		return
	}
	var body playlistBody
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 512<<10)).Decode(&body); err != nil || len(body.Tracks) == 0 || len(body.Tracks) > 200 {
		writeError(w, http.StatusBadRequest, "bad_request", "Provide 1-200 tracks.")
		return
	}
	added, err := h.Playlists.AddTracks(r.Context(), user.ID, id, body.Tracks)
	if err != nil {
		playlistError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"added": added})
}

func (h *MusicHandler) RemovePlaylistTrack(w http.ResponseWriter, r *http.Request) {
	user, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	id, ok := playlistID(w, r)
	if !ok {
		return
	}
	if err := h.Playlists.RemoveTrack(r.Context(), user.ID, id, chi.URLParam(r, "trackId")); err != nil {
		playlistError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *MusicHandler) MovePlaylistTrack(w http.ResponseWriter, r *http.Request) {
	user, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	id, ok := playlistID(w, r)
	if !ok {
		return
	}
	var body struct {
		From int `json:"from"`
		To   int `json:"to"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4<<10)).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "from and to are required.")
		return
	}
	if err := h.Playlists.MoveTrack(r.Context(), user.ID, id, body.From, body.To); err != nil {
		playlistError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
