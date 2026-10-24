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

// languageQueries maps a language the user picked to high-quality Spotify search queries,
// tried in order until one returns tracks.
func languageQueries(language string) []string {
	l := strings.ToLower(strings.TrimSpace(language))
	mapping := map[string][]string{
		"punjabi":    {"punjabi hits", "top punjabi tracks", "punjabi trending", "latest punjabi", "punjabi songs"},
		"hindi":      {"bollywood hits", "top hindi tracks", "hindi trending", "bollywood romance", "hindi songs"},
		"tamil":      {"tamil hits", "top tamil tracks", "tamil trending", "kollywood hits", "tamil songs"},
		"telugu":     {"telugu hits", "top telugu tracks", "telugu trending", "tollywood hits", "telugu songs"},
		"malayalam":  {"malayalam hits", "top malayalam tracks", "mollywood hits", "malayalam songs"},
		"kannada":    {"kannada hits", "kannada trending", "sandalwood hits", "kannada songs"},
		"bengali":    {"bengali hits", "bangla hits", "bengali pop", "bengali songs"},
		"marathi":    {"marathi hits", "marathi trending", "marathi songs"},
		"gujarati":   {"gujarati hits", "gujarati trending", "gujarati songs"},
		"urdu":       {"urdu hits", "pakistani pop hits", "urdu songs"},
		"korean":     {"k-pop hits", "k-pop trending", "top k-pop", "korean pop"},
		"japanese":   {"j-pop hits", "anime hits", "j-pop", "japanese pop"},
		"spanish":    {"latin hits", "reggaeton hits", "latin pop", "spanish hits"},
		"portuguese": {"brazilian hits", "mpb hits", "funk brasil", "portuguese hits"},
		"arabic":     {"arabic hits", "arab trending", "arabic pop", "arabic songs"},
		"french":     {"french pop hits", "chanson hits", "top french", "french songs"},
		"german":     {"german pop hits", "deutsch pop", "german hits"},
		"turkish":    {"turkish pop hits", "turkce pop", "turkish hits"},
		"english":    {"top hits", "pop hits", "today top hits", "trending english"},
	}
	if q, ok := mapping[l]; ok {
		return q
	}
	return []string{l + " hits", l + " trending", l + " songs"}
}

// genreQueries maps a genre the user tuned to Spotify search queries,
// prioritizing authentic, beloved tracks.
func genreQueries(genre string) []string {
	g := strings.ToLower(strings.TrimSpace(genre))
	mapping := map[string][]string{
		"lofi":       {"hindi lofi", "lofi chill beats", "lofi beats", "lofi hip hop", "chill lofi songs"},
		"lo-fi":      {"hindi lofi", "lofi chill beats", "lofi beats", "lofi hip hop", "chill lofi songs"},
		"sufi":       {"sufi hits", "best of sufi", "sufi songs", "qawwali hits", "coke studio"},
		"ghazal":     {"ghazal hits", "best of ghazals", "jagjit singh ghazals", "ghazal songs"},
		"devotional": {"devotional hits", "bhajan hits", "shree krishna bhajan", "shiv bhajan", "bhakti songs"},
		"edm":        {"edm hits", "dance hits", "electronic dance", "party edm"},
		"hip hop":    {"hip hop hits", "top hip hop", "desi hip hop hits", "rap hits"},
		"hip-hop":    {"hip hop hits", "top hip hop", "desi hip hop hits", "rap hits"},
		"r&b":        {"r&b hits", "soul hits", "best r&b"},
		"r-b":        {"r&b hits", "soul hits", "best r&b"},
		"afrobeats":  {"afrobeats hits", "afropop", "afrobeats"},
		"classical":  {"indian classical", "classical essentials", "classical ragas"},
		"indie":      {"indie hits", "hindi indie hits", "indie pop"},
		"rock":       {"rock classics", "rock hits", "top rock"},
		"pop":        {"pop hits", "top pop tracks", "trending pop"},
		"metal":      {"metal hits", "heavy metal hits", "metal classics"},
		"jazz":       {"jazz classics", "smooth jazz", "jazz hits"},
		"soul":       {"soul classics", "soul hits"},
		"blues":      {"blues classics", "blues hits"},
		"folk":       {"folk music", "folk hits"},
		"country":    {"country hits", "country classics"},
		"reggae":     {"reggae hits", "reggae classics"},
		"latin":      {"latin hits", "latin pop", "reggaeton hits"},
	}
	if q, ok := mapping[g]; ok {
		return q
	}
	return []string{g + " hits", g + " trending", g + " songs"}
}

