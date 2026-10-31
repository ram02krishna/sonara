package dashboard

import (
	"strings"
	"testing"
	"unicode/utf8"

	"github.com/sonara/api/internal/models"
)

func TestTitleCase(t *testing.T) {
	if got := titleCase("hip hop"); got != "Hip Hop" {
		t.Errorf("got %q", got)
	}
	for _, in := range []string{"हिन्दी गाने", "éclair pop", "日本語 pop"} {
		if got := titleCase(in); !utf8.ValidString(got) {
			t.Errorf("titleCase(%q) produced invalid UTF-8: %q", in, got)
		}
	}
}

func TestSlug(t *testing.T) {
	if got := slug("Hip Hop!"); got != "hip-hop" {
		t.Errorf("got %q", got)
	}
	a, b := slug("अरिजीत सिंह"), slug("श्रेया घोषाल")
	if a == "" || b == "" || a == b {
		t.Errorf("non-ASCII slugs collide: %q %q", a, b)
	}
}

func TestBuildSeedsKeepsNonASCIIArtists(t *testing.T) {
	seeds := buildSeeds(nil, nil, models.Preferences{Artists: []models.ArtistSummary{{Name: "अरिजीत सिंह"}, {Name: "श्रेया घोषाल"}}})
	if len(seeds) != 2 {
		t.Fatalf("got %d seeds", len(seeds))
	}
	for _, s := range seeds {
		if strings.HasSuffix(s.id, "artist-") {
			t.Errorf("empty slug: %q", s.id)
		}
	}
}

func TestHashTasteIncludesOnboarded(t *testing.T) {
	if hashTaste(models.Preferences{}, nil) == hashTaste(models.Preferences{Onboarded: true}, nil) {
		t.Error("onboarding must change the dashboard cache key")
	}
}
