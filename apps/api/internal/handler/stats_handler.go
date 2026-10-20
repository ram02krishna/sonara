package handler

import (
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
	"github.com/sonara/api/internal/repository"
)

type StatsHandler struct {
	historyRepo *repository.HistoryRepository
	userRepo    *repository.UserRepository
}

func NewStatsHandler(historyRepo *repository.HistoryRepository, userRepo *repository.UserRepository) *StatsHandler {
	return &StatsHandler{
		historyRepo: historyRepo,
		userRepo:    userRepo,
	}
}

func (h *StatsHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	timeRange := r.URL.Query().Get("range")
	if timeRange == "" {
		timeRange = "4weeks"
	}

	userID := uuid.Nil
	cookie, err := r.Cookie("sonara_session")
	if err == nil && cookie.Value != "" {
		if u, err := h.userRepo.GetUserBySession(r.Context(), cookie.Value); err == nil && u != nil {
			userID = u.ID
		}
	}

	report, err := h.historyRepo.GetStats(r.Context(), userID, timeRange)
	if err != nil {
		http.Error(w, "Failed to retrieve stats", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(report)
}
