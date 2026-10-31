package handler

import (
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/sonara/api/internal/models"
)

func TestAlbumQuery(t *testing.T) {
	cases := map[string]string{
		`genre:"hip hop"`: "hip hop",
		`genre:"rock"`:    "rock",
		"hindi songs":     "hindi songs",
		"bhajan":          "bhajan",
	}
	for in, want := range cases {
		if got := albumQuery(in); got != want {
			t.Errorf("albumQuery(%q) = %q, want %q", in, got, want)
		}
	}
	for _, c := range categories {
		if q := albumQuery(c.Queries[len(c.Queries)-1]); strings.ContainsAny(q, `"`) || q == "" {
			t.Errorf("category %s produces album query %q", c.Slug, q)
		}
	}
}

func TestCleanPlaylist(t *testing.T) {
	if _, _, ok := cleanPlaylist(playlistBody{Name: "  "}); ok {
		t.Error("blank name accepted")
	}
	if _, _, ok := cleanPlaylist(playlistBody{Name: strings.Repeat("a", 121)}); ok {
		t.Error("121-char name accepted")
	}
	// 100 characters but 300 bytes must still be accepted.
	if _, _, ok := cleanPlaylist(playlistBody{Name: strings.Repeat("गा", 50)}); !ok {
		t.Error("non-ASCII name under 120 characters rejected")
	}
	_, desc, _ := cleanPlaylist(playlistBody{Name: "x", Description: strings.Repeat("é", 600)})
	if n := len([]rune(desc)); n != 500 {
		t.Errorf("description has %d runes", n)
	}
	if !strings.HasSuffix(desc, "é") || strings.ContainsRune(desc, '\uFFFD') {
		t.Error("description cut in the middle of a character")
	}
}

func TestSanitizePreferences(t *testing.T) {
	out := SanitizePreferences(models.Preferences{
		Languages: []string{" Hindi ", "hindi", ""}, Genres: []string{"Hip Hop"},
		Country: "in", AudioQuality: "bogus", NormalizeAudio: true,
		Artists: []models.ArtistSummary{{Name: "A"}, {Name: "a"}, {Name: ""}},
	})
	if !reflect.DeepEqual(out.Languages, []string{"hindi"}) || out.Country != "IN" || out.AudioQuality != "lossless" || len(out.Artists) != 1 || !out.NormalizeAudio {
		t.Errorf("%+v", out)
	}
}

func TestRateLimitIPv6(t *testing.T) {
	h := RateLimit(2, time.Minute)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(200) }))
	status := func(addr string) int {
		req := httptest.NewRequest("POST", "/", nil)
		req.RemoteAddr = addr
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec.Code
	}
	// Two different bare IPv6 addresses sharing a prefix must not share a bucket.
	for i := 0; i < 3; i++ {
		if c := status("2001:db8::1"); i < 2 && c != 200 {
			t.Fatalf("request %d: %d", i, c)
		} else if i == 2 && c != http.StatusTooManyRequests {
			t.Fatalf("third request not limited: %d", c)
		}
	}
	if c := status("2001:db8::2"); c != 200 {
		t.Errorf("other IPv6 client was limited: %d", c)
	}
	if c := status("[2001:db8::3]:5555"); c != 200 {
		t.Errorf("host:port form: %d", c)
	}
}
