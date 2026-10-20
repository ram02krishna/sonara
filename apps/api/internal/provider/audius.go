package provider

import (
	"context"
	"fmt"

	"github.com/sonara/api/internal/models"
)

// AudiusProvider implements MusicProvider for open decentralized audio streaming
type AudiusProvider struct {
	appName string
}

func NewAudiusProvider(appName string) *AudiusProvider {
	if appName == "" {
		appName = "Sonara"
	}
	return &AudiusProvider{appName: appName}
}

func (a *AudiusProvider) Name() string { return "audius" }

func (a *AudiusProvider) GetProfile(ctx context.Context, accessToken string) (*models.User, error) {
	return nil, fmt.Errorf("audius: free decentralized streaming does not require login")
}

func (a *AudiusProvider) GetTopArtists(ctx context.Context, accessToken string, timeRange string, limit int) ([]models.Artist, error) {
	return []models.Artist{}, nil
}

func (a *AudiusProvider) GetTopTracks(ctx context.Context, accessToken string, timeRange string, limit int) ([]models.Track, error) {
	return []models.Track{}, nil
}

func (a *AudiusProvider) GetRecentlyPlayed(ctx context.Context, accessToken string, limit int) ([]models.PlayHistoryItem, error) {
	return []models.PlayHistoryItem{}, nil
}

func (a *AudiusProvider) Search(ctx context.Context, accessToken string, query string, types string, limit int) (*models.SearchResult, error) {
	return &models.SearchResult{}, nil
}

func (a *AudiusProvider) GetPlaybackState(ctx context.Context, accessToken string) (*models.PlaybackState, error) {
	return nil, nil
}

func (a *AudiusProvider) GetDevices(ctx context.Context, accessToken string) ([]models.Device, error) {
	return []models.Device{{ID: "audius-web", Name: "Sonara Web Player (Audius Direct)", Type: "Computer", IsActive: true}}, nil
}

func (a *AudiusProvider) TransferPlayback(ctx context.Context, accessToken string, deviceIDs []string, play bool) error {
	return nil
}

func (a *AudiusProvider) Play(ctx context.Context, accessToken string, deviceID string, body map[string]interface{}) error {
	return nil
}

func (a *AudiusProvider) Pause(ctx context.Context, accessToken string, deviceID string) error {
	return nil
}

func (a *AudiusProvider) Next(ctx context.Context, accessToken string, deviceID string) error {
	return nil
}

func (a *AudiusProvider) Previous(ctx context.Context, accessToken string, deviceID string) error {
	return nil
}

func (a *AudiusProvider) Seek(ctx context.Context, accessToken string, positionMs int) error {
	return nil
}

func (a *AudiusProvider) SetVolume(ctx context.Context, accessToken string, volumePercent int) error {
	return nil
}

// JamendoProvider implements MusicProvider for Creative Commons music catalog
type JamendoProvider struct {
	clientID string
}

func NewJamendoProvider(clientID string) *JamendoProvider {
	return &JamendoProvider{clientID: clientID}
}

func (j *JamendoProvider) Name() string { return "jamendo" }

func (j *JamendoProvider) GetProfile(ctx context.Context, accessToken string) (*models.User, error) {
	return nil, fmt.Errorf("jamendo does not use user OAuth")
}

func (j *JamendoProvider) GetTopArtists(ctx context.Context, accessToken string, timeRange string, limit int) ([]models.Artist, error) {
	return []models.Artist{}, nil
}

func (j *JamendoProvider) GetTopTracks(ctx context.Context, accessToken string, timeRange string, limit int) ([]models.Track, error) {
	return []models.Track{}, nil
}

func (j *JamendoProvider) GetRecentlyPlayed(ctx context.Context, accessToken string, limit int) ([]models.PlayHistoryItem, error) {
	return []models.PlayHistoryItem{}, nil
}

func (j *JamendoProvider) Search(ctx context.Context, accessToken string, query string, types string, limit int) (*models.SearchResult, error) {
	return &models.SearchResult{}, nil
}

func (j *JamendoProvider) GetPlaybackState(ctx context.Context, accessToken string) (*models.PlaybackState, error) {
	return nil, nil
}

func (j *JamendoProvider) GetDevices(ctx context.Context, accessToken string) ([]models.Device, error) {
	return []models.Device{}, nil
}

func (j *JamendoProvider) TransferPlayback(ctx context.Context, accessToken string, deviceIDs []string, play bool) error {
	return nil
}

func (j *JamendoProvider) Play(ctx context.Context, accessToken string, deviceID string, body map[string]interface{}) error {
	return nil
}

func (j *JamendoProvider) Pause(ctx context.Context, accessToken string, deviceID string) error {
	return nil
}

func (j *JamendoProvider) Next(ctx context.Context, accessToken string, deviceID string) error {
	return nil
}

func (j *JamendoProvider) Previous(ctx context.Context, accessToken string, deviceID string) error {
	return nil
}

func (j *JamendoProvider) Seek(ctx context.Context, accessToken string, positionMs int) error {
	return nil
}

func (j *JamendoProvider) SetVolume(ctx context.Context, accessToken string, volumePercent int) error {
	return nil
}
