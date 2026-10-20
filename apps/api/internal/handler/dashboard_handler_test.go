package handler

import (
	"testing"

	"github.com/sonara/api/internal/models"
)

func TestSanitizePreferences(t *testing.T) {
	in := models.Preferences{
		Languages: []string{" Hindi ", "hindi", "", "Punjabi"},
		Genres:    []string{"LoFi", "lofi"},
		Artists:   []models.ArtistSummary{{Name: "  Arijit Singh "}, {Name: "arijit singh"}, {Name: ""}},
		Country:   "in",
	}
	out := SanitizePreferences(in)
	if len(out.Languages) != 2 || out.Languages[0] != "hindi" {
		t.Fatalf("languages not normalised/deduped: %v", out.Languages)
	}
	if len(out.Genres) != 1 || len(out.Artists) != 1 || out.Artists[0].Name != "Arijit Singh" {
		t.Fatalf("genres/artists not cleaned: %+v", out)
	}
	if out.Country != "IN" || !out.Onboarded {
		t.Fatalf("country/onboarded wrong: %+v", out)
	}
	if bad := SanitizePreferences(models.Preferences{Country: "India"}); bad.Country != "" {
		t.Fatalf("invalid country must be dropped, got %q", bad.Country)
	}
}
