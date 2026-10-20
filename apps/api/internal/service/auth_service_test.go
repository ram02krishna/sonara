package service

import (
	"context"
	"testing"

	"github.com/sonara/api/internal/config"
	"github.com/sonara/api/internal/repository"
)

func TestNativeAuthService(t *testing.T) {
	ctx := context.Background()
	cfg := &config.Config{AppEnv: "test"}
	userRepo := repository.NewUserRepository(nil) // memory mode
	authSvc := NewAuthService(cfg, userRepo, nil)

	// 1. Register
	user, sessionID, err := authSvc.Register(ctx, "artist@sonara.app", "masterpassword", "Studio Artist")
	if err != nil {
		t.Fatalf("Register failed: %v", err)
	}
	if user == nil || user.DisplayName != "Studio Artist" {
		t.Fatalf("Unexpected user: %+v", user)
	}
	if sessionID == "" {
		t.Fatal("Expected sessionID, got empty")
	}

	// 2. Validate Session
	sessUser, err := authSvc.GetUserBySession(ctx, sessionID)
	if err != nil || sessUser == nil || sessUser.ID != user.ID {
		t.Fatalf("Session user lookup failed: %v, %+v", err, sessUser)
	}

	// 3. Login with correct password
	loginUser, loginSess, err := authSvc.Login(ctx, "artist@sonara.app", "masterpassword")
	if err != nil || loginUser == nil || loginSess == "" {
		t.Fatalf("Login failed: %v", err)
	}

	// 4. Login with bad password
	_, _, err = authSvc.Login(ctx, "artist@sonara.app", "wrongpassword")
	if err == nil {
		t.Fatal("Expected error on invalid password, got nil")
	}

	// 5. Guest Login
	guest, guestSess, err := authSvc.GuestLogin(ctx, "Guest Explorer")
	if err != nil || guest == nil || guestSess == "" {
		t.Fatalf("Guest login failed: %v", err)
	}

	// 6. Logout
	if err := authSvc.Logout(ctx, sessionID); err != nil {
		t.Fatalf("Logout failed: %v", err)
	}
	expiredUser, _ := authSvc.GetUserBySession(ctx, sessionID)
	if expiredUser != nil {
		t.Fatal("Expected nil session user after logout")
	}
}
