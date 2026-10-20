package provider_test

import (
	"regexp"
	"strconv"
	"strings"
	"testing"
)

var lrcLineRegex = regexp.MustCompile(`^\[(\d{2}):(\d{2}\.\d{2,3})\](.*)$`)

func parseLRCLine(line string) (float64, string, bool) {
	line = strings.TrimSpace(line)
	matches := lrcLineRegex.FindStringSubmatch(line)
	if len(matches) != 4 {
		return 0, "", false
	}
	min, _ := strconv.ParseFloat(matches[1], 64)
	sec, _ := strconv.ParseFloat(matches[2], 64)
	return min*60 + sec, strings.TrimSpace(matches[3]), true
}

func TestLRCLineParsing_Table(t *testing.T) {
	tests := []struct {
		name       string
		input      string
		wantTime   float64
		wantWords  string
		wantParsed bool
	}{
		{
			name:       "Standard 2 decimal seconds",
			input:      "[00:14.50] I'm tryna put you in the worst mood",
			wantTime:   14.50,
			wantWords:  "I'm tryna put you in the worst mood",
			wantParsed: true,
		},
		{
			name:       "Minute mark with 3 decimals",
			input:      "[01:22.456] Main bitch out of your league too",
			wantTime:   82.456,
			wantWords:  "Main bitch out of your league too",
			wantParsed: true,
		},
		{
			name:       "Empty lyrics line (instrumental break)",
			input:      "[02:00.00] ",
			wantTime:   120.0,
			wantWords:  "",
			wantParsed: true,
		},
		{
			name:       "Invalid non-LRC line",
			input:      "Just some plain text without timestamps",
			wantTime:   0,
			wantWords:  "",
			wantParsed: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotTime, gotWords, ok := parseLRCLine(tt.input)
			if ok != tt.wantParsed {
				t.Fatalf("parseLRCLine() ok = %v, want %v", ok, tt.wantParsed)
			}
			if ok {
				if gotTime != tt.wantTime {
					t.Errorf("gotTime = %v, want %v", gotTime, tt.wantTime)
				}
				if gotWords != tt.wantWords {
					t.Errorf("gotWords = %q, want %q", gotWords, tt.wantWords)
				}
			}
		})
	}
}
