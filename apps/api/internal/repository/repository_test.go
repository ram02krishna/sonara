package repository

import (
	"context"
	"errors"
	"os"
	"reflect"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/sonara/api/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

func TestPGTextArrayRoundTrip(t *testing.T) {
	cases := [][]string{
		{},
		{"rock"},
		{"rock", "hip hop", "r&b"},
		{`say "hi"`, `back\slash`, "a,b", "हिन्दी"},
	}
	for _, in := range cases {
		out, err := parsePGTextArray(formatPGTextArray(in))
		if err != nil {
			t.Fatalf("parse(%q): %v", in, err)
		}
		if !reflect.DeepEqual(out, in) && !(len(in) == 0 && len(out) == 0) {
			t.Errorf("round trip: got %q want %q", out, in)
		}
	}
}

func TestParsePGTextArrayUnquoted(t *testing.T) {
	// Postgres does not quote simple elements, which the old JSON-based parser could not read.
	got, err := parsePGTextArray(`{rock,pop,"hip hop",NULL}`)
	if err != nil {
		t.Fatal(err)
	}
	if want := []string{"rock", "pop", "hip hop"}; !reflect.DeepEqual(got, want) {
		t.Errorf("got %q want %q", got, want)
	}
	if _, err := parsePGTextArray("not an array"); err == nil {
		t.Error("expected an error for invalid input")
	}
}

func TestStreakFrom(t *testing.T) {
	now := time.Date(2026, 10, 30, 15, 0, 0, 0, time.UTC)
	day := func(offset int) time.Time {
		return time.Date(2026, 10, 30+offset, 0, 0, 0, 0, time.UTC)
	}
	if got := streakFrom(nil, now); got != 0 {
		t.Errorf("empty: %d", got)
	}
	if got := streakFrom([]time.Time{day(0), day(-1), day(-2), day(-4)}, now); got != 3 {
		t.Errorf("today streak: %d", got)
	}
	if got := streakFrom([]time.Time{day(-1), day(-2)}, now); got != 2 {
		t.Errorf("yesterday streak: %d", got)
	}
	if got := streakFrom([]time.Time{day(-2)}, now); got != 0 {
		t.Errorf("broken streak: %d", got)
	}
}

func TestPickCovers(t *testing.T) {
	got := pickCovers([]string{"", "a", "a", "b", "c", "d", "e"})
	if want := []string{"a", "b", "c", "d"}; !reflect.DeepEqual(got, want) {
		t.Errorf("got %v want %v", got, want)
	}
}

// ---- integration tests (need PostgreSQL: set TEST_DATABASE_URL) ----

func testDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: gormlogger.Default.LogMode(gormlogger.Silent), TranslateError: true})
	if err != nil {
		t.Fatal(err)
	}
	return db
}

type repos struct {
	users   *UserRepository
	prefs   *PreferencesRepository
	history *HistoryRepository
	library *LibraryRepository
	coll    *CollectionRepository
	lists   *PlaylistRepository
}

func setup(t *testing.T) repos {
	t.Helper()
	db := testDB(t)
	r := repos{
		users: NewUserRepository(db), prefs: NewPreferencesRepository(db), history: NewHistoryRepository(db),
		library: NewLibraryRepository(db), coll: NewCollectionRepository(db), lists: NewPlaylistRepository(db),
	}
	ctx := context.Background()
	// users first: the other tables reference it.
	for _, ensure := range []func(context.Context) error{
		r.users.EnsureSchema, r.history.EnsureSchema, r.prefs.EnsureSchema,
		r.library.EnsureSchema, r.coll.EnsureSchema, r.lists.EnsureSchema,
	} {
		if err := ensure(ctx); err != nil {
			t.Fatalf("EnsureSchema: %v", err)
		}
	}
	return r
}

func newUser(t *testing.T, r repos) *models.User {
	t.Helper()
	id := uuid.New()
	u, err := r.users.CreateUser(context.Background(), &models.User{
		ID: id, Email: id.String() + "@example.test", PasswordHash: "x", DisplayName: "Test", Country: "IN",
	})
	if err != nil {
		t.Fatal(err)
	}
	return u
}

func track(id, art string) models.Track {
	return models.Track{
		ID: id, Name: "Song " + id, URI: "spotify:track:" + id, DurationMs: 180000,
		Artists: []models.ArtistSummary{{ID: "ar-" + id, Name: "Artist " + id}},
		Album:   models.AlbumSummary{Name: "Album", Images: []models.Image{{URL: art}}},
	}
}

func TestPreferencesRoundTrip(t *testing.T) {
	r := setup(t)
	ctx := context.Background()
	u := newUser(t, r)

	in := models.Preferences{
		Languages: []string{"hindi", "k-pop"}, Genres: []string{"hip hop", "r&b", "lofi"},
		Artists: []models.ArtistSummary{{ID: "1", Name: "Arijit Singh"}},
		Country: "IN", Onboarded: true, AudioQuality: "high", NormalizeAudio: false,
	}
	if err := r.prefs.Save(ctx, u.ID, in); err != nil {
		t.Fatal(err)
	}
	got, err := r.prefs.Get(ctx, u.ID)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got.Languages, in.Languages) || !reflect.DeepEqual(got.Genres, in.Genres) {
		t.Errorf("arrays: got %v / %v", got.Languages, got.Genres)
	}
	if got.NormalizeAudio {
		t.Error("normalize_audio=false was replaced by the column default")
	}
	if got.AudioQuality != "high" || !got.Onboarded || got.Country != "IN" {
		t.Errorf("scalars: %+v", got)
	}

	// Saving again flips values back (upsert path).
	in.NormalizeAudio, in.Onboarded = true, false
	if err := r.prefs.Save(ctx, u.ID, in); err != nil {
		t.Fatal(err)
	}
	got, _ = r.prefs.Get(ctx, u.ID)
	if !got.NormalizeAudio || got.Onboarded {
		t.Errorf("upsert: %+v", got)
	}

	// Unknown users get defaults, not an error.
	def, err := r.prefs.Get(ctx, uuid.New())
	if err != nil || !def.NormalizeAudio || def.AudioQuality != "lossless" {
		t.Errorf("defaults: %+v %v", def, err)
	}
}

func TestDuplicateEmail(t *testing.T) {
	r := setup(t)
	u := newUser(t, r)
	_, err := r.users.CreateUser(context.Background(), &models.User{Email: u.Email, DisplayName: "Other"})
	if !errors.Is(err, ErrEmailTaken) {
		t.Errorf("got %v, want ErrEmailTaken", err)
	}
}

func TestPlaylistLifecycle(t *testing.T) {
	r := setup(t)
	ctx := context.Background()
	u := newUser(t, r)

	pl, err := r.lists.Create(ctx, u.ID, "Mix", "desc")
	if err != nil {
		t.Fatal(err)
	}
	added, err := r.lists.AddTracks(ctx, u.ID, pl.ID, []models.Track{track("a", "art-a"), track("b", "art-b"), track("a", "art-a"), track("c", "art-c")})
	if err != nil || added != 3 {
		t.Fatalf("added=%d err=%v", added, err)
	}
	if again, _ := r.lists.AddTracks(ctx, u.ID, pl.ID, []models.Track{track("a", "art-a")}); again != 0 {
		t.Errorf("duplicate track re-added: %d", again)
	}
	if _, err := r.lists.AddTracks(ctx, uuid.New(), pl.ID, []models.Track{track("z", "")}); !errors.Is(err, ErrPlaylistNotFound) {
		t.Errorf("foreign user: %v", err)
	}

	list, err := r.lists.List(ctx, u.ID)
	if err != nil || len(list) != 1 || list[0].TrackCount != 3 || len(list[0].Covers) != 3 {
		t.Fatalf("list: %+v %v", list, err)
	}

	if err := r.lists.MoveTrack(ctx, u.ID, pl.ID, 0, 2); err != nil {
		t.Fatal(err)
	}
	got, _ := r.lists.Get(ctx, u.ID, pl.ID)
	if ids := []string{got.Tracks[0].ID, got.Tracks[1].ID, got.Tracks[2].ID}; !reflect.DeepEqual(ids, []string{"b", "c", "a"}) {
		t.Errorf("order after move: %v", ids)
	}
	if err := r.lists.MoveTrack(ctx, u.ID, pl.ID, 0, 9); !errors.Is(err, ErrInvalidPosition) {
		t.Errorf("bad move: %v", err)
	}
	if err := r.lists.RemoveTrack(ctx, u.ID, pl.ID, "c"); err != nil {
		t.Fatal(err)
	}
	got, _ = r.lists.Get(ctx, u.ID, pl.ID)
	if len(got.Tracks) != 2 || got.Tracks[1].ID != "a" {
		t.Errorf("after remove: %+v", got.Tracks)
	}
}

func TestStatsAndDeleteUser(t *testing.T) {
	r := setup(t)
	ctx := context.Background()
	u := newUser(t, r)

	tr := track("s1", "art")
	for i := 0; i < 3; i++ {
		if err := r.history.RecordPlay(ctx, u.ID, &tr, 60000, "video"); err != nil {
			t.Fatal(err)
		}
	}
	stats, err := r.history.GetStats(ctx, u.ID, "4weeks")
	if err != nil {
		t.Fatal(err)
	}
	if stats.PlayCount != 3 || stats.UniqueTracks != 1 || stats.TotalMinutes != 3 || stats.StreakDays != 1 || len(stats.DailyListening) != 1 {
		t.Errorf("stats: %+v", stats)
	}
	if top, err := r.history.TopTracks(ctx, u.ID, "alltime", 5); err != nil || len(top) != 1 {
		t.Errorf("top tracks: %v %v", top, err)
	}
	if recent, err := r.history.Recent(ctx, u.ID, 5); err != nil || len(recent) != 1 {
		t.Errorf("recent: %v %v", recent, err)
	}

	_ = r.library.SaveTrack(ctx, u.ID, tr)
	_ = r.coll.Add(ctx, u.ID, "artist", "x", map[string]string{"id": "x"})
	_ = r.prefs.Save(ctx, u.ID, models.Preferences{Genres: []string{"pop"}})
	pl, _ := r.lists.Create(ctx, u.ID, "P", "")
	_, _ = r.lists.AddTracks(ctx, u.ID, pl.ID, []models.Track{tr})
	_ = r.users.CreateSession(ctx, "sess-"+u.ID.String(), u.ID, time.Now().Add(time.Hour))

	if err := r.users.DeleteUser(ctx, u.ID); err != nil {
		t.Fatal(err)
	}
	for table, col := range map[string]string{
		"play_history": "user_id", "user_library": "user_id", "user_collection": "user_id",
		"user_preferences": "user_id", "sonara_playlists": "user_id", "sessions": "user_id",
	} {
		var n int64
		if err := r.users.db.Table(table).Where(col+" = ?", u.ID).Count(&n).Error; err != nil || n != 0 {
			t.Errorf("%s still has %d rows (err=%v)", table, n, err)
		}
	}
	var n int64
	r.users.db.Table("sonara_playlist_tracks").Where("playlist_id = ?", pl.ID).Count(&n)
	if n != 0 {
		t.Errorf("playlist tracks left behind: %d", n)
	}
}
