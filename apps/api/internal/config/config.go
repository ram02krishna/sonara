package config

import (
	"os"
	"strings"
)

type Config struct {
	Port                 string
	AppEnv               string
	DatabaseURL          string
	RedisURL             string
	SessionSecret        string
	TokenEncryptionKey   string
	SpotifyClientID      string
	SpotifyClientSecret  string
	SpotifyRedirectURI   string
	SpotifyDefaultMarket string
	LRCLIBApiURL         string
	YouTubeAPIKey        string
	CookieSecure         bool
	AllowedOrigins       string
}

func loadDotEnv() {
	candidates := []string{".env", "../.env", "../../.env"}
	for _, p := range candidates {
		data, err := os.ReadFile(p)
		if err != nil {
			continue
		}
		lines := strings.Split(string(data), "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				k := strings.TrimSpace(parts[0])
				v := strings.TrimSpace(parts[1])
				v = strings.Trim(v, `"'`)
				if os.Getenv(k) == "" {
					_ = os.Setenv(k, v)
				}
			}
		}
		break
	}
}

func Load() *Config {
	loadDotEnv()
	return &Config{
		Port:                 getEnv("API_PORT", getEnv("PORT", "8080")),
		AppEnv:               getEnv("APP_ENV", "development"),
		DatabaseURL:          getEnv("DATABASE_URL", "postgres://sonara:sonarasecret@localhost:5432/sonara?sslmode=disable"),
		RedisURL:             getEnv("REDIS_URL", "redis://localhost:6379/0"),
		SessionSecret:        getEnv("SESSION_SECRET", "super-secret-sonara-session-encryption-key-32chars!"),
		TokenEncryptionKey:   getEnv("TOKEN_ENCRYPTION_KEY", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"),
		SpotifyClientID:      getEnv("SPOTIFY_CLIENT_ID", ""),
		SpotifyClientSecret:  getEnv("SPOTIFY_CLIENT_SECRET", ""),
		SpotifyDefaultMarket: getEnv("SPOTIFY_DEFAULT_MARKET", "US"),
		SpotifyRedirectURI:   getEnv("SPOTIFY_REDIRECT_URI", "http://127.0.0.1:8080/api/v1/auth/callback"),
		YouTubeAPIKey:        getEnv("YOUTUBE_API_KEY", ""),
		CookieSecure:         getEnv("COOKIE_SECURE", "false") == "true",
		LRCLIBApiURL:         getEnv("LRCLIB_API_URL", "https://lrclib.net/api"),
		AllowedOrigins:       getEnv("ALLOWED_ORIGINS", "http://127.0.0.1:3000"),
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
