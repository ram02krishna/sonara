package config

import (
	"os"
)

type Config struct {
	Port               string
	AppEnv             string
	DatabaseURL        string
	RedisURL           string
	SessionSecret      string
	TokenEncryptionKey string
	SpotifyClientID     string
	SpotifyClientSecret string
	SpotifyRedirectURI  string
	LRCLIBApiURL       string
	AllowedOrigins     string
}

func Load() *Config {
	return &Config{
		Port:               getEnv("API_PORT", "8080"),
		AppEnv:             getEnv("APP_ENV", "development"),
		DatabaseURL:        getEnv("DATABASE_URL", "postgres://sonara:sonarasecret@localhost:5432/sonara?sslmode=disable"),
		RedisURL:           getEnv("REDIS_URL", "redis://localhost:6379/0"),
		SessionSecret:      getEnv("SESSION_SECRET", "super-secret-sonara-session-encryption-key-32chars!"),
		TokenEncryptionKey: getEnv("TOKEN_ENCRYPTION_KEY", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"),
		SpotifyClientID:     getEnv("SPOTIFY_CLIENT_ID", ""),
		SpotifyClientSecret: getEnv("SPOTIFY_CLIENT_SECRET", ""),
		SpotifyRedirectURI:  getEnv("SPOTIFY_REDIRECT_URI", "http://localhost:8080/api/v1/auth/callback"),
		LRCLIBApiURL:       getEnv("LRCLIB_API_URL", "https://lrclib.net/api"),
		AllowedOrigins:     getEnv("ALLOWED_ORIGINS", "http://localhost:3000"),
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
