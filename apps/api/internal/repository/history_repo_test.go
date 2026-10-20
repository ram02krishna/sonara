package repository

import (
	"testing"
	"time"
)

func day(s string) time.Time { t, _ := time.Parse("2006-01-02", s); return t }

func TestStreakFrom(t *testing.T) {
	now := day("2026-10-20")
	cases := []struct {
		name string
		days []time.Time
		want int
	}{
		{"no plays", nil, 0},
		{"today only", []time.Time{day("2026-10-20")}, 1},
		{"three in a row ending today", []time.Time{day("2026-10-20"), day("2026-10-19"), day("2026-10-18")}, 3},
		{"streak still alive from yesterday", []time.Time{day("2026-10-19"), day("2026-10-18")}, 2},
		{"gap breaks streak", []time.Time{day("2026-10-20"), day("2026-10-18")}, 1},
		{"stale history", []time.Time{day("2026-10-10")}, 0},
	}
	for _, c := range cases {
		if got := streakFrom(c.days, now); got != c.want {
			t.Errorf("%s: got %d want %d", c.name, got, c.want)
		}
	}
}
