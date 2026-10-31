package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/sonara/api/internal/dashboard"
	"github.com/sonara/api/internal/models"
)

// DashboardHandler serves the personalised, server-driven home dashboard and
// the taste preferences that seed it.
type DashboardHandler struct {
	music   *MusicHandler
	builder *dashboard.Builder
}

func NewDashboardHandler(music *MusicHandler, builder *dashboard.Builder) *DashboardHandler {
	return &DashboardHandler{music: music, builder: builder}
}

func (h *DashboardHandler) GetDashboard(w http.ResponseWriter, r *http.Request) {
	user, ok := h.music.requireUser(w, r)
	if !ok {
		return
	}
	prefs, err := h.music.prefsRepo.Get(r.Context(), user.ID)
	if err != nil {
		// Falling back to empty preferences here would wrongly send the user back to onboarding.
		writeError(w, http.StatusInternalServerError, "preferences_unavailable", "Could not load your taste preferences.")
		return
	}
	if prefs.Country == "" {
		prefs.Country = user.Country
	}
	resp := h.builder.Build(r.Context(), dashboard.Input{
		UserUUID: user.ID,
		UserID:   user.ID.String(),
		Market:   prefs.Country,
		Prefs:    prefs,
	})
	writeJSON(w, http.StatusOK, resp)
}

func (h *DashboardHandler) GetPreferences(w http.ResponseWriter, r *http.Request) {
	user, ok := h.music.requireUser(w, r)
	if !ok {
		return
	}
	prefs, err := h.music.prefsRepo.Get(r.Context(), user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "preferences_unavailable", "Could not load your taste preferences.")
		return
	}
	if prefs.Country == "" {
		prefs.Country = user.Country
	}
	writeJSON(w, http.StatusOK, prefs)
}

func (h *DashboardHandler) PutPreferences(w http.ResponseWriter, r *http.Request) {
	user, ok := h.music.requireUser(w, r)
	if !ok {
		return
	}
	current, err := h.music.prefsRepo.Get(r.Context(), user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "preferences_unavailable", "Could not load your taste preferences.")
		return
	}
	// Start from what is stored so a client that omits a field (the web app never sends
	// audio_quality / normalize_audio) does not silently reset it to the zero value.
	in := current
	// Decode into fresh slices: json reuses an existing slice's backing array, which would
	// otherwise mutate the stored value when the in-memory repository is in use.
	in.Languages = append([]string(nil), current.Languages...)
	in.Genres = append([]string(nil), current.Genres...)
	in.Artists = append([]models.ArtistSummary(nil), current.Artists...)
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10)).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "Invalid preferences payload.")
		return
	}
	clean := SanitizePreferences(in)
	if err := h.music.prefsRepo.Save(r.Context(), user.ID, clean); err != nil {
		writeError(w, http.StatusInternalServerError, "save_failed", "Could not save your preferences.")
		return
	}
	writeJSON(w, http.StatusOK, clean)
}

// SanitizePreferences trims, lowercases, dedupes and bounds user input.
func SanitizePreferences(in models.Preferences) models.Preferences {
	out := models.Preferences{
		Languages:      cleanList(in.Languages, 10, 40),
		Genres:         cleanList(in.Genres, 20, 60),
		Artists:        []models.ArtistSummary{},
		Onboarded:      true,
		NormalizeAudio: in.NormalizeAudio,
	}
	if in.AudioQuality == "high" || in.AudioQuality == "normal" || in.AudioQuality == "lossless" {
		out.AudioQuality = in.AudioQuality
	} else {
		out.AudioQuality = "lossless"
	}
	seen := map[string]bool{}
	for _, a := range in.Artists {
		name := strings.TrimSpace(a.Name)
		if name == "" || len(name) > 120 || seen[strings.ToLower(name)] || len(out.Artists) >= 30 {
			continue
		}
		seen[strings.ToLower(name)] = true
		out.Artists = append(out.Artists, models.ArtistSummary{ID: strings.TrimSpace(a.ID), Name: name, URI: a.URI})
	}
	if c := strings.ToUpper(strings.TrimSpace(in.Country)); len(c) == 2 && c[0] >= 'A' && c[0] <= 'Z' && c[1] >= 'A' && c[1] <= 'Z' {
		out.Country = c
	}
	return out
}

func cleanList(in []string, maxItems, maxLen int) []string {
	out := []string{}
	seen := map[string]bool{}
	for _, v := range in {
		v = strings.ToLower(strings.TrimSpace(v))
		if v == "" || len(v) > maxLen || seen[v] || len(out) >= maxItems {
			continue
		}
		seen[v] = true
		out = append(out, v)
	}
	return out
}
