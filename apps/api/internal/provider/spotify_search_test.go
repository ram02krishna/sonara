package provider

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func newTestProvider(t *testing.T, h http.HandlerFunc) *SpotifyProvider {
	t.Helper()
	srv := httptest.NewServer(h)
	t.Cleanup(srv.Close)
	p := NewSpotifyProvider("id", "secret", "in")
	p.baseURL = srv.URL
	return p
}

func TestSearchClampsLimitSetsMarketAndSurvivesNullPlaylists(t *testing.T) {
	var gotQuery string
	p := newTestProvider(t, func(w http.ResponseWriter, r *http.Request) {
		gotQuery = r.URL.RawQuery
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
		  "tracks": {"items": [{"id":"t1","name":"Song","uri":"spotify:track:t1","artists":[{"id":"a1","name":"Art"}],"album":{"id":"al","name":"Alb","images":[{"url":"u"}]}}]},
		  "artists": {"items": [{"id":"a1","name":"Art","genres":["bollywood"],"images":[]}]},
		  "playlists": {"items": [null, {"id":"p1","name":"PL","owner":{"display_name":"Me"},"items":{"total":7}}]}
		}`))
	})
	res, err := p.Search(context.Background(), "user-token", "arijit", "", 50, "from_token")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(gotQuery, "limit=10") || !strings.Contains(gotQuery, "market=from_token") {
		t.Fatalf("expected limit capped at 10 and market=from_token, got %q", gotQuery)
	}
	if len(res.Tracks) != 1 || len(res.Artists) != 1 || res.Artists[0].Genres[0] != "bollywood" {
		t.Fatalf("unexpected tracks/artists: %+v", res)
	}
	if len(res.Playlists) != 1 || res.Playlists[0].TracksTotal != 7 || res.Playlists[0].OwnerName != "Me" {
		t.Fatalf("null playlist entries must be skipped and renamed items.total read: %+v", res.Playlists)
	}
}

func TestListEndpointsReturnTypedErrorsInsteadOfEmptyData(t *testing.T) {
	p := newTestProvider(t, func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
	})
	if _, err := p.GetTopArtists(context.Background(), "tok", "medium_term", 10); StatusOf(err) != http.StatusForbidden {
		t.Fatalf("expected 403 APIError, got %v", err)
	}
	if err := p.Play(context.Background(), "tok", "", nil); StatusOf(err) != http.StatusForbidden {
		t.Fatalf("playback errors must not be swallowed, got %v", err)
	}
}

func TestPlaybackNoActiveDeviceSurfaces404(t *testing.T) {
	p := newTestProvider(t, func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, `{"error":{"reason":"NO_ACTIVE_DEVICE"}}`, http.StatusNotFound)
	})
	if err := p.Pause(context.Background(), "tok", ""); StatusOf(err) != http.StatusNotFound {
		t.Fatalf("expected 404 for no active device, got %v", err)
	}
}

func TestLogoutOfAppTokenUsesDefaultMarket(t *testing.T) {
	p := NewSpotifyProvider("id", "secret", "in")
	if got := p.resolveMarket(false, ""); got != "IN" {
		t.Fatalf("logged-out search should use default market IN, got %s", got)
	}
	if got := p.resolveMarket(true, ""); got != "from_token" {
		t.Fatalf("logged-in search should use from_token, got %s", got)
	}
}
