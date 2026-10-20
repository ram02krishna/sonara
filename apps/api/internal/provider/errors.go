package provider

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// APIError is a typed upstream (Spotify) failure so handlers and the dashboard
// can tell "section unavailable" (403/404) from "slow down" (429) from "log in again" (401).
type APIError struct {
	Status  int
	Message string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("spotify api error %d: %s", e.Status, e.Message)
}

// errFromResponse builds an APIError from a non-2xx response (body is read, not closed).
func errFromResponse(resp *http.Response) error {
	b, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
	return &APIError{Status: resp.StatusCode, Message: strings.TrimSpace(string(b))}
}

// StatusOf returns the upstream HTTP status carried by err, or 0 when it is not an APIError.
func StatusOf(err error) int {
	var apiErr *APIError
	if errors.As(err, &apiErr) {
		return apiErr.Status
	}
	return 0
}
