package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/sonara/api/internal/config"
	"github.com/sonara/api/internal/handler"
	"github.com/sonara/api/internal/provider"
	"github.com/sonara/api/internal/repository"
	"github.com/sonara/api/internal/service"
)

func main() {
	// Setup structured zerolog
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	if os.Getenv("APP_ENV") != "production" {
		log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stdout, TimeFormat: "15:04:05"})
	}

	log.Info().Msg("Starting Sonara Backend-For-Frontend (BFF) API...")

	cfg := config.Load()

	// Initialize Database Pool (with graceful fallback if not yet running)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var dbPool *pgxpool.Pool
	poolConfig, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err == nil {
		poolConfig.MaxConns = 25
		poolConfig.MinConns = 2
		poolConfig.MaxConnLifetime = 1 * time.Hour
		dbPool, err = pgxpool.NewWithConfig(ctx, poolConfig)
		if err != nil {
			log.Warn().Err(err).Msg("Postgres connection failed, running in in-memory fallback mode")
			dbPool = nil
		} else {
			log.Info().Msg("PostgreSQL connected successfully")
		}
	}

	// Initialize Redis
	var rdb *redis.Client
	opt, err := redis.ParseURL(cfg.RedisURL)
	if err == nil {
		rdb = redis.NewClient(opt)
		if err := rdb.Ping(context.Background()).Err(); err != nil {
			log.Warn().Err(err).Msg("Redis connection failed, running with in-memory state")
			rdb = nil
		} else {
			log.Info().Msg("Redis connected successfully")
		}
	}

	// Providers & Repositories
	userRepo := repository.NewUserRepository(dbPool)
	historyRepo := repository.NewHistoryRepository(dbPool)
	authService := service.NewAuthService(cfg, userRepo, rdb)

	spotifyProvider := provider.NewSpotifyProvider(cfg.SpotifyClientID, cfg.SpotifyClientSecret)
	lrclibClient := provider.NewLRCLIBClient(cfg.LRCLIBApiURL)

	// Handlers
	authHandler := handler.NewAuthHandler(cfg, authService, userRepo, spotifyProvider)
	musicHandler := handler.NewMusicHandler(userRepo, authService, spotifyProvider)
	lyricsHandler := handler.NewLyricsHandler(lrclibClient)
	statsHandler := handler.NewStatsHandler(historyRepo, userRepo)

	// Setup Chi Router
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))

	// CORS configuration
	allowedOrigins := strings.Split(cfg.AllowedOrigins, ",")
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Healthcheck
	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"healthy","service":"sonara-api"}`))
	})

	// API V1 Route Group
	r.Route("/api/v1", func(api chi.Router) {
		// Auth Routes
		api.Get("/auth/login", authHandler.Login)
		api.Get("/auth/callback", authHandler.Callback)
		api.Post("/auth/logout", authHandler.Logout)
		api.Get("/auth/session", authHandler.Session)

		// Music & Catalog
		api.Get("/me", musicHandler.GetMe)
		api.Get("/me/top/artists", musicHandler.GetTopArtists)
		api.Get("/me/top/tracks", musicHandler.GetTopTracks)
		api.Get("/me/recently-played", musicHandler.GetRecentlyPlayed)
		api.Get("/search", musicHandler.Search)

		// Playback Controls
		api.Get("/me/player", musicHandler.GetPlaybackState)
		api.Get("/me/player/devices", musicHandler.GetDevices)
		api.Put("/me/player/play", musicHandler.Play)
		api.Put("/me/player/pause", musicHandler.Pause)
		api.Post("/me/player/next", musicHandler.Next)
		api.Post("/me/player/previous", musicHandler.Previous)
		api.Put("/me/player/seek", musicHandler.Seek)
		api.Put("/me/player/volume", musicHandler.SetVolume)

		// Lyrics & Analytics
		api.Get("/lyrics", lyricsHandler.GetLyrics)
		api.Get("/stats", statsHandler.GetStats)
	})

	// Server Start & Graceful Shutdown
	addr := fmt.Sprintf(":%s", cfg.Port)
	srv := &http.Server{
		Addr:         addr,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Info().Str("addr", addr).Msg("Sonara API HTTP server listening")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("Server failed to start")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info().Msg("Shutting down Sonara API server...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Error().Err(err).Msg("Server forced shutdown")
	}

	if dbPool != nil {
		dbPool.Close()
	}

	log.Info().Msg("Sonara API successfully stopped")
}
