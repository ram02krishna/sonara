package handler

import (
	"net/http"
	"strconv"

	"github.com/sonara/api/internal/provider"
)

type LyricsHandler struct {
	lyricsClient provider.LyricsProvider
}

func NewLyricsHandler(lyricsClient provider.LyricsProvider) *LyricsHandler {
	return &LyricsHandler{lyricsClient: lyricsClient}
}

func (h *LyricsHandler) GetLyrics(w http.ResponseWriter, r *http.Request) {
	trackName := r.URL.Query().Get("track_name")
	artistName := r.URL.Query().Get("artist_name")
	durationMs, _ := strconv.Atoi(r.URL.Query().Get("duration_ms"))

	if trackName == "" || artistName == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "track_name and artist_name are required")
		return
	}

	lyrics, err := h.lyricsClient.GetLyrics(r.Context(), trackName, artistName, durationMs)
	if err != nil || lyrics == nil {
		writeError(w, http.StatusNotFound, "lyrics_not_found", "No lyrics found for this track.")
		return
	}

	writeJSON(w, http.StatusOK, lyrics)
}
