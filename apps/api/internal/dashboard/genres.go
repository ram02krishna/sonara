package dashboard

import (
	"sort"
	"strings"

	"github.com/sonara/api/internal/models"
)

// RankGenres scores genres from a user's top artists. Spotify returns top
// artists most-listened-first, so earlier artists weigh more. The result is the
// user's real taste (any language/region Spotify tags), most important first.
func RankGenres(artists []models.Artist) []string {
	scores := map[string]float64{}
	order := map[string]int{}
	n := 0
	for i, a := range artists {
		weight := 1.0 / float64(i+2) // 0.5, 0.33, 0.25, ...
		for _, g := range a.Genres {
			g = strings.ToLower(strings.TrimSpace(g))
			if g == "" {
				continue
			}
			if _, seen := order[g]; !seen {
				order[g] = n
				n++
			}
			scores[g] += weight
		}
	}
	genres := make([]string, 0, len(scores))
	for g := range scores {
		genres = append(genres, g)
	}
	sort.Slice(genres, func(i, j int) bool {
		if scores[genres[i]] != scores[genres[j]] {
			return scores[genres[i]] > scores[genres[j]]
		}
		return order[genres[i]] < order[genres[j]]
	})
	return genres
}

// languageQueries maps a language the user picked to Spotify search queries,
// tried in order until one returns tracks. The last entry is plain free text so
// a language still works even if Spotify has no matching genre tag.
func languageQueries(language string) []string {
	l := strings.ToLower(strings.TrimSpace(language))
	genre := map[string][]string{
		"hindi":      {"bollywood", "filmi", "hindi indie"},
		"punjabi":    {"punjabi pop", "desi hip hop"},
		"tamil":      {"tamil pop", "kollywood"},
		"telugu":     {"telugu pop", "tollywood"},
		"malayalam":  {"malayalam pop", "mollywood"},
		"kannada":    {"kannada pop", "sandalwood"},
		"bengali":    {"bangla pop", "bengali pop"},
		"marathi":    {"marathi pop"},
		"gujarati":   {"gujarati pop"},
		"urdu":       {"pakistani pop", "urdu pop"},
		"korean":     {"k-pop", "korean pop"},
		"japanese":   {"j-pop", "japanese pop"},
		"spanish":    {"latin pop", "reggaeton"},
		"portuguese": {"brazilian pop", "mpb"},
		"arabic":     {"arabic pop", "arab pop"},
		"french":     {"french pop", "chanson"},
		"german":     {"german pop"},
		"turkish":    {"turkish pop"},
		"english":    {"pop", "indie pop"},
	}[l]
	out := make([]string, 0, len(genre)+1)
	for _, g := range genre {
		out = append(out, `genre:"`+g+`"`)
	}
	out = append(out, l+" songs")
	return out
}
