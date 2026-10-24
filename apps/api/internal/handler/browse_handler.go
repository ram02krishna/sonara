package handler

import (
	"net/http"
	"strings"
	"sync"

	"github.com/go-chi/chi/v5"
	"github.com/sonara/api/internal/models"
)

// Category is a "Browse all" tile. Spotify's /browse/categories endpoint was
// removed for Development Mode apps, so Sonara defines its own, each backed by
// catalogue search queries (tried in order).
type Category struct {
	Slug    string   `json:"slug"`
	Title   string   `json:"title"`
	Group   string   `json:"group"` // "language" | "genre" | "mood"
	Color   string   `json:"color"`
	Queries []string `json:"-"`
}

var categories = []Category{
	{"hindi", "Hindi", "language", "#e11d48", []string{`genre:"bollywood"`, `genre:"filmi"`, "hindi songs"}},
	{"punjabi", "Punjabi", "language", "#ea580c", []string{`genre:"punjabi pop"`, "punjabi songs"}},
	{"tamil", "Tamil", "language", "#7c3aed", []string{`genre:"tamil pop"`, `genre:"kollywood"`, "tamil songs"}},
	{"telugu", "Telugu", "language", "#0891b2", []string{`genre:"telugu pop"`, `genre:"tollywood"`, "telugu songs"}},
	{"malayalam", "Malayalam", "language", "#16a34a", []string{`genre:"malayalam pop"`, "malayalam songs"}},
	{"kannada", "Kannada", "language", "#ca8a04", []string{`genre:"kannada pop"`, "kannada songs"}},
	{"bengali", "Bengali", "language", "#db2777", []string{`genre:"bangla pop"`, "bengali songs"}},
	{"marathi", "Marathi", "language", "#4f46e5", []string{"marathi songs"}},
	{"korean", "K-Pop", "language", "#d946ef", []string{`genre:"k-pop"`, "korean pop"}},
	{"japanese", "J-Pop", "language", "#f43f5e", []string{`genre:"j-pop"`, "japanese pop"}},
	{"spanish", "Latin", "language", "#f97316", []string{`genre:"latin pop"`, `genre:"reggaeton"`}},
	{"english", "English Pop", "language", "#2563eb", []string{`genre:"pop"`, "top hits"}},
	{"hip-hop", "Hip-Hop", "genre", "#475569", []string{`genre:"hip hop"`, "hip hop"}},
	{"rock", "Rock", "genre", "#b91c1c", []string{`genre:"rock"`}},
	{"edm", "Dance & EDM", "genre", "#0ea5e9", []string{`genre:"edm"`, `genre:"dance"`}},
	{"indie", "Indie", "genre", "#65a30d", []string{`genre:"indie"`}},
	{"jazz", "Jazz", "genre", "#b45309", []string{`genre:"jazz"`}},
	{"classical", "Classical", "genre", "#6d28d9", []string{`genre:"classical"`}},
	{"rnb", "R&B & Soul", "genre", "#be185d", []string{`genre:"r&b"`, `genre:"soul"`}},
	{"devotional", "Devotional", "genre", "#d97706", []string{`genre:"devotional"`, "bhajan", "devotional songs"}},
	{"sufi", "Sufi & Ghazal", "genre", "#0f766e", []string{`genre:"sufi"`, `genre:"ghazal"`}},
	{"chill", "Chill", "mood", "#0d9488", []string{"chill vibes", `genre:"chill"`}},
	{"focus", "Focus", "mood", "#1d4ed8", []string{"focus instrumental", `genre:"lo-fi"`}},
	{"workout", "Workout", "mood", "#dc2626", []string{"workout", "gym motivation"}},
	{"party", "Party", "mood", "#c026d3", []string{"party hits", `genre:"dance pop"`}},
	{"romance", "Romance", "mood", "#e11d48", []string{"romantic songs", "love songs"}},
	{"sleep", "Sleep", "mood", "#334155", []string{"sleep music", "calm piano"}},
	{"road-trip", "Road Trip", "mood", "#ca8a04", []string{"road trip songs", "driving songs"}},
}

func (h *MusicHandler) ListCategories(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{"categories": categories})
}

// GetCategory returns songs, artists and albums for a browse tile.
func (h *MusicHandler) GetCategory(w http.ResponseWriter, r *http.Request) {
	slug := strings.ToLower(chi.URLParam(r, "slug"))
	var cat *Category
	for i := range categories {
		if categories[i].Slug == slug {
			cat = &categories[i]
		}
	}
	if cat == nil {
		writeError(w, http.StatusNotFound, "not_found", "Unknown category.")
		return
	}
	market := h.marketFor(r, h.resolveUser(r))
	out := &models.SearchResult{}
	var mu sync.Mutex
	var wg sync.WaitGroup
	for page := 0; page < 2; page++ {
		wg.Add(1)
		go func(page int) {
			defer wg.Done()
			for _, q := range cat.Queries {
				res, err := h.Catalog.Search(r.Context(), q, "track", 10, page*10, market)
				if err == nil && len(res.Tracks) > 0 {
					mu.Lock()
					out.Tracks = append(out.Tracks, res.Tracks...)
					mu.Unlock()
					return
				}
			}
		}(page)
	}
	wg.Add(2)
	go func() {
		defer wg.Done()
		for _, q := range cat.Queries {
			if res, err := h.Catalog.Search(r.Context(), q, "artist", 10, 0, market); err == nil && len(res.Artists) > 0 {
				mu.Lock()
				out.Artists = res.Artists
				mu.Unlock()
				return
			}
		}
	}()
	go func() {
		defer wg.Done()
		if res, err := h.Catalog.Search(r.Context(), strings.Replace(cat.Queries[len(cat.Queries)-1], `genre:"`, "", 1), "album", 10, 0, market); err == nil {
			mu.Lock()
			out.Albums = res.Albums
			mu.Unlock()
		}
	}()
	wg.Wait()

	seen := map[string]bool{}
	tracks := out.Tracks[:0]
	for _, t := range out.Tracks {
		if !seen[t.ID] {
			seen[t.ID] = true
			tracks = append(tracks, t)
		}
	}
	out.Tracks = tracks
	writeJSON(w, http.StatusOK, map[string]interface{}{"category": cat, "tracks": out.Tracks, "artists": out.Artists, "albums": out.Albums})
}
