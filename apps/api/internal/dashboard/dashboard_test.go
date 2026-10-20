package dashboard

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/sonara/api/internal/models"
)

func TestRankGenresWeightsEarlierArtistsAndKeepsAnyLanguage(t *testing.T) {
	artists := []models.Artist{
		{Name: "A", Genres: []string{"bollywood", "filmi"}},
		{Name: "B", Genres: []string{"punjabi pop", "bollywood"}},
		{Name: "C", Genres: []string{"k-pop"}},
	}
	got := RankGenres(artists)
	if len(got) != 4 || got[0] != "bollywood" {
		t.Fatalf("expected bollywood first of 4 genres, got %v", got)
	}
	if got[len(got)-1] != "k-pop" {
		t.Fatalf("lowest-weighted artist's genre should be last, got %v", got)
	}
}

func TestLanguageQueriesEndWithFreeText(t *testing.T) {
	q := languageQueries("Hindi")
	if q[0] != `genre:"bollywood"` {
		t.Fatalf("unexpected first query %q", q[0])
	}
	if q[len(q)-1] != "hindi songs" {
		t.Fatalf("free-text fallback missing: %v", q)
	}
	if unknown := languageQueries("Swahili"); len(unknown) != 1 || unknown[0] != "swahili songs" {
		t.Fatalf("unknown language should fall back to free text, got %v", unknown)
	}
}

func TestBuildSeedsBlendsListeningAndPreferencesWithCap(t *testing.T) {
	seeds := buildSeeds([]string{"bollywood", "filmi", "desi pop"}, nil, models.Preferences{
		Languages: []string{"tamil", "korean"},
		Genres:    []string{"lofi", "jazz"},
	})
	if len(seeds) != maxTasteShelves {
		t.Fatalf("expected cap of %d shelves, got %d", maxTasteShelves, len(seeds))
	}
	if seeds[0].id != "genre-bollywood" || seeds[2].id != "lang-tamil" {
		t.Fatalf("unexpected seed order: %+v", seeds)
	}
}

func TestBuildSeedsFallsBackToArtistsWhenGenresMissing(t *testing.T) {
	seeds := buildSeeds(nil, []models.Artist{{Name: "Arijit Singh"}, {Name: "Diljit Dosanjh"}}, models.Preferences{})
	if len(seeds) != 2 || !strings.HasPrefix(seeds[0].id, "artist-") {
		t.Fatalf("expected artist-based seeds, got %+v", seeds)
	}
}

// fakeSource lets the builder be tested without Spotify.
type fakeSource struct {
	artists []models.Artist
	tracks  []models.Track
	recent  []models.PlayHistoryItem
	albums  []models.AlbumSummary
	failNew bool
	queries []string
}

func (f *fakeSource) GetTopArtists(context.Context, string, string, int) ([]models.Artist, error) {
	return f.artists, nil
}
func (f *fakeSource) GetTopTracks(context.Context, string, string, int) ([]models.Track, error) {
	return f.tracks, nil
}
func (f *fakeSource) GetRecentlyPlayed(context.Context, string, int) ([]models.PlayHistoryItem, error) {
	return f.recent, nil
}
func (f *fakeSource) Search(_ context.Context, _ string, q, _ string, _ int, _ string) (*models.SearchResult, error) {
	f.queries = append(f.queries, q)
	return &models.SearchResult{Tracks: []models.Track{{ID: "t-" + q, Name: q}}}, nil
}
func (f *fakeSource) SearchNewAlbums(context.Context, string, string, int) ([]models.AlbumSummary, error) {
	if f.failNew {
		return nil, errors.New("403")
	}
	return f.albums, nil
}

func sectionIDs(r *models.DashboardResponse) []string {
	ids := make([]string, 0, len(r.Sections))
	for _, s := range r.Sections {
		ids = append(ids, s.ID)
	}
	return ids
}

func TestBuildPersonalisesAndDropsFailedSections(t *testing.T) {
	src := &fakeSource{
		artists: []models.Artist{{ID: "1", Name: "A", Genres: []string{"bollywood"}}},
		tracks:  []models.Track{{ID: "x", Name: "X"}},
		failNew: true, // Spotify refused new releases: the rest must still render
	}
	resp := NewBuilder(src, NewMemoryCache()).Build(context.Background(), Input{
		UserID: "u1", Token: "tok", Market: "from_token",
		Prefs: models.Preferences{Onboarded: true, Languages: []string{"punjabi"}},
	})
	ids := strings.Join(sectionIDs(resp), ",")
	for _, want := range []string{"hero", "top-artists", "genre-bollywood", "lang-punjabi", "mix", "top-tracks"} {
		if !strings.Contains(ids, want) {
			t.Fatalf("missing section %q in %s", want, ids)
		}
	}
	if strings.Contains(ids, "new-releases") {
		t.Fatalf("failed section must be omitted, got %s", ids)
	}
	if resp.NeedsOnboarding {
		t.Fatal("user with history must not need onboarding")
	}
}

func TestBuildColdStartNeedsOnboardingAndUsesPreferencesWhenPresent(t *testing.T) {
	cold := NewBuilder(&fakeSource{}, NewMemoryCache()).Build(context.Background(), Input{UserID: "new", Token: "t"})
	if !cold.NeedsOnboarding {
		t.Fatal("brand-new user with no history/prefs must be sent to onboarding")
	}

	src := &fakeSource{}
	seeded := NewBuilder(src, NewMemoryCache()).Build(context.Background(), Input{
		UserID: "new2", Token: "t",
		Prefs: models.Preferences{Onboarded: true, Languages: []string{"tamil"}, Genres: []string{"lofi"}},
	})
	if seeded.NeedsOnboarding {
		t.Fatal("onboarded user must not be asked again")
	}
	if len(seeded.Sections) == 0 || seeded.Sections[0].ID != "hero" {
		t.Fatalf("cold-start user with prefs should get a hero from their shelf, got %v", sectionIDs(seeded))
	}
}

func TestBuildUsesCacheForSharedShelves(t *testing.T) {
	src := &fakeSource{}
	cache := NewMemoryCache()
	in := Input{UserID: "u", Token: "t", Market: "from_token", Prefs: models.Preferences{Onboarded: true, Genres: []string{"jazz"}}}
	b := NewBuilder(src, cache)
	b.Build(context.Background(), in)
	first := len(src.queries)
	b.Build(context.Background(), in)
	if len(src.queries) != first {
		t.Fatalf("second build should be served from cache (%d -> %d searches)", first, len(src.queries))
	}
}
