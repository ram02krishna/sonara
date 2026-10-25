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
	"github.com/sonara/api/internal/dashboard"
	"github.com/sonara/api/internal/handler"
	"github.com/sonara/api/internal/provider"
	"github.com/sonara/api/internal/repository"
	"github.com/sonara/api/internal/service"
)

func main() {
	// Logger
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	if os.Getenv("APP_ENV") != "production" {
		log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stdout, TimeFormat: "15:04:05"})
	}

	log.Info().Msg("Starting Sonara Backend-For-Frontend (BFF) API...")

	cfg := config.Load()

	// Database pool
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
		} else if pingErr := dbPool.Ping(ctx); pingErr != nil {
			log.Warn().Err(pingErr).Msg("Postgres ping failed (check credentials/server), running in in-memory fallback mode")
			dbPool.Close()
			dbPool = nil
		} else {
			log.Info().Msg("PostgreSQL connected successfully")
		}
	}

	// Redis
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

	// Repositories
	ctxBG := context.Background()
	userRepo := repository.NewUserRepository(dbPool)
	historyRepo := repository.NewHistoryRepository(dbPool)
	prefsRepo := repository.NewPreferencesRepository(dbPool)
	libraryRepo := repository.NewLibraryRepository(dbPool)
	collectionRepo := repository.NewCollectionRepository(dbPool)
	playlistRepo := repository.NewPlaylistRepository(dbPool)
	// Schema init (users first)
	for _, step := range []struct {
		name string
		fn   func(context.Context) error
	}{
		{"users", userRepo.EnsureSchema}, {"history", historyRepo.EnsureSchema}, {"preferences", prefsRepo.EnsureSchema},
		{"library", libraryRepo.EnsureSchema}, {"collection", collectionRepo.EnsureSchema}, {"playlists", playlistRepo.EnsureSchema},
	} {
		if err := step.fn(ctxBG); err != nil {
			log.Warn().Err(err).Str("schema", step.name).Msg("could not ensure schema")
		}
	}

	authService := service.NewAuthService(cfg, userRepo, rdb)
	spotifyProvider := provider.NewSpotifyProvider(cfg.SpotifyClientID, cfg.SpotifyClientSecret, cfg.SpotifyDefaultMarket)
	if !spotifyProvider.Configured() {
		log.Warn().Msg("SPOTIFY_CLIENT_ID/SPOTIFY_CLIENT_SECRET not set: catalogue search will fall back to iTunes only")
	}
	previewClient := provider.NewITunesPreviewClient()
	youtubeClient := provider.NewYouTubeClient(cfg.YouTubeAPIKey)

	var dashCache dashboard.Cache = dashboard.NewMemoryCache()
	if rdb != nil {
		dashCache = dashboard.NewRedisCache(rdb)
	}
	dashBuilder := dashboard.NewBuilder(spotifyProvider, historyRepo, dashCache)
	lrclibClient := provider.NewLRCLIBClient(cfg.LRCLIBApiURL)

	// Handlers
	authHandler := handler.NewAuthHandler(cfg, authService)
	musicHandler := handler.NewMusicHandler(handler.MusicDeps{
		Users: userRepo, Prefs: prefsRepo, History: historyRepo, Library: libraryRepo, Collection: collectionRepo,
		Playlists: playlistRepo, Auth: authService, Catalog: spotifyProvider, Previews: previewClient, YouTube: youtubeClient,
		AuthHandler: authHandler,
	})
	dashboardHandler := handler.NewDashboardHandler(musicHandler, dashBuilder)
	lyricsHandler := handler.NewLyricsHandler(lrclibClient)
	statsHandler := handler.NewStatsHandler(historyRepo, musicHandler)

	// Router
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))

	// CORS
	allowedOrigins := []string{
		"http://localhost:3000",
		"http://127.0.0.1:3000",
		"http://localhost:8080",
		"http://127.0.0.1:8080",
	}
	if cfg.AllowedOrigins != "" {
		for _, o := range strings.Split(cfg.AllowedOrigins, ",") {
			if trimmed := strings.TrimSpace(o); trimmed != "" {
				allowedOrigins = append(allowedOrigins, trimmed)
			}
		}
	}
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: allowedOrigins,
		AllowOriginFunc: func(r *http.Request, origin string) bool {
			if strings.HasPrefix(origin, "http://localhost:") || strings.HasPrefix(origin, "http://127.0.0.1:") {
				return true
			}
			for _, o := range allowedOrigins {
				if strings.EqualFold(o, origin) {
					return true
				}
			}
			return false
		},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"service":"Sonara API","status":"healthy","version":"1.0.0"}`))
	})

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"healthy","service":"sonara-api"}`))
	})

	// API routes
	r.Route("/api/v1", func(api chi.Router) {
		api.Get("/config", musicHandler.GetConfig)

		// Auth (rate-limited)
		api.Group(func(g chi.Router) {
			g.Use(handler.RateLimit(20, time.Minute))
			g.Post("/auth/signup", authHandler.Signup)
			g.Post("/auth/login", authHandler.Login)
			g.Post("/auth/guest", authHandler.Guest)
		})
		api.Post("/auth/logout", authHandler.Logout)
		api.Get("/auth/session", authHandler.Session)

		// Account
		api.Get("/me", musicHandler.GetMe)
		api.Put("/me/profile", musicHandler.UpdateProfile)
		api.Put("/me/password", musicHandler.ChangePassword)
		api.Post("/me/upgrade", musicHandler.UpgradeGuest)
		api.Delete("/me", musicHandler.DeleteAccount)
		api.Get("/me/export", musicHandler.ExportData)
		api.Get("/me/preferences", dashboardHandler.GetPreferences)
		api.Put("/me/preferences", dashboardHandler.PutPreferences)

		// Catalog
		api.Get("/search", musicHandler.Search)
		api.Get("/preview", musicHandler.GetPreview)
		api.Get("/video", musicHandler.GetVideo)
		api.Get("/artists/{id}", musicHandler.GetArtist)
		api.Get("/albums/{id}", musicHandler.GetAlbum)
		api.Get("/browse", musicHandler.ListCategories)
		api.Get("/browse/{slug}", musicHandler.GetCategory)
		api.Get("/dashboard", dashboardHandler.GetDashboard)
		api.Get("/lyrics", lyricsHandler.GetLyrics)

		// History & stats
		api.Get("/me/recently-played", musicHandler.GetRecentlyPlayed)
		api.Get("/me/top/tracks", musicHandler.GetTopTracks)
		api.Get("/me/top/artists", musicHandler.GetTopArtists)
		api.Delete("/me/history", musicHandler.ClearHistory)
		api.Get("/stats", statsHandler.GetStats)
		api.Post("/history", statsHandler.RecordPlay)

		// Library
		api.Get("/me/tracks", musicHandler.GetSavedTracks)
		api.Put("/me/library", musicHandler.SaveTrack)
		api.Delete("/me/library", musicHandler.RemoveTrack)
		api.Get("/me/library/contains", musicHandler.TrackSaved)
		api.Get("/me/following", musicHandler.ListFollowing())
		api.Put("/me/following/{id}", musicHandler.FollowArtist())
		api.Delete("/me/following/{id}", musicHandler.UnfollowArtist())
		api.Get("/me/albums", musicHandler.ListSavedAlbums())
		api.Put("/me/albums/{id}", musicHandler.SaveAlbum())
		api.Delete("/me/albums/{id}", musicHandler.UnsaveAlbum())

		// Playlists
		api.Get("/playlists", musicHandler.ListPlaylists)
		api.Post("/playlists", musicHandler.CreatePlaylist)
		api.Get("/playlists/{id}", musicHandler.GetPlaylist)
		api.Put("/playlists/{id}", musicHandler.UpdatePlaylist)
		api.Delete("/playlists/{id}", musicHandler.DeletePlaylist)
		api.Post("/playlists/{id}/tracks", musicHandler.AddPlaylistTracks)
		api.Put("/playlists/{id}/move", musicHandler.MovePlaylistTrack)
		api.Delete("/playlists/{id}/tracks/{trackId}", musicHandler.RemovePlaylistTrack)
	})

	// Server
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
