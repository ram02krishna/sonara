package handler

import (
	"encoding/json"
	"net/http"

	"github.com/sonara/api/internal/models"
	"github.com/sonara/api/internal/repository"
)

type StatsHandler struct {
	historyRepo *repository.HistoryRepository
	music       *MusicHandler
}

func NewStatsHandler(historyRepo *repository.HistoryRepository, music *MusicHandler) *StatsHandler {
	return &StatsHandler{historyRepo: historyRepo, music: music}
}

func (h *StatsHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	_, user, ok := h.music.requireUser(w, r)
	if !ok {
		return
	}
	timeRange := r.URL.Query().Get("range")
	switch timeRange {
	case "4weeks", "6months", "alltime":
	default:
		timeRange = "4weeks"
	}
	report, err := h.historyRepo.GetStats(r.Context(), user.ID, timeRange)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "stats_unavailable", "Could not load your listening stats.")
		return
	}
	writeJSON(w, http.StatusOK, report)
}

// RecordPlay is called by the web player once a track has genuinely been played for a while.
func (h *StatsHandler) RecordPlay(w http.ResponseWriter, r *http.Request) {
	_, user, ok := h.music.requireUser(w, r)
	if !ok {
		return
	}
	var in struct {
		Track      models.Track `json:"track"`
		ListenedMs int          `json:"listened_ms"`
		Source     string       `json:"source"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10)).Decode(&in); err != nil || in.Track.ID == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "A track is required.")
		return
	}
	if in.ListenedMs < 0 || in.ListenedMs > 24*3600*1000 {
		in.ListenedMs = 0
	}
	if in.Source != "spotify" && in.Source != "preview" {
		in.Source = "spotify"
	}
	if err := h.historyRepo.RecordPlay(r.Context(), user.ID, &in.Track, in.ListenedMs, in.Source); err != nil {
		writeError(w, http.StatusInternalServerError, "record_failed", "Could not record this play.")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
