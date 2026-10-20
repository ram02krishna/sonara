package crypto_test

import (
	"bytes"
	"testing"

	"github.com/sonara/api/internal/crypto"
)

func TestEncryptDecrypt_Table(t *testing.T) {
	tests := []struct {
		name      string
		plaintext string
		secretKey string
	}{
		{
			name:      "Standard OAuth access token",
			plaintext: "BQD81kdf8924jkla98234-access-token-123",
			secretKey: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
		},
		{
			name:      "Empty string",
			plaintext: "",
			secretKey: "secret-key-32-chars-long-encryption!",
		},
		{
			name:      "Long refresh token with special chars",
			plaintext: "AQB123-refresh-token!@#$%^&*()_+{}[]:;\"'<>?,./",
			secretKey: "super-secure-production-encryption-passphrase",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ciphertext, err := crypto.Encrypt([]byte(tt.plaintext), tt.secretKey)
			if err != nil {
				t.Fatalf("Encrypt() error = %v", err)
			}

			if bytes.Equal(ciphertext, []byte(tt.plaintext)) && len(tt.plaintext) > 0 {
				t.Errorf("Ciphertext matches plaintext, not encrypted")
			}

			decrypted, err := crypto.Decrypt(ciphertext, tt.secretKey)
			if err != nil {
				t.Fatalf("Decrypt() error = %v", err)
			}

			if string(decrypted) != tt.plaintext {
				t.Errorf("Decrypt() got = %s, want = %s", string(decrypted), tt.plaintext)
			}
		})
	}
}

func TestDecrypt_TamperedCiphertext(t *testing.T) {
	secret := "test-secret-key-32-characters!!"
	ciphertext, err := crypto.Encrypt([]byte("sensitive-data"), secret)
	if err != nil {
		t.Fatalf("Encrypt() error = %v", err)
	}

	// Tamper with last byte
	ciphertext[len(ciphertext)-1] ^= 0xFF

	_, err = crypto.Decrypt(ciphertext, secret)
	if err == nil {
		t.Errorf("Decrypt() expected error on tampered ciphertext, got nil")
	}
}

func TestDecrypt_WrongKey(t *testing.T) {
	ciphertext, err := crypto.Encrypt([]byte("sensitive-data"), "correct-key-32-bytes-long-12345")
	if err != nil {
		t.Fatalf("Encrypt() error = %v", err)
	}

	_, err = crypto.Decrypt(ciphertext, "wrong-key-32-bytes-long-987654321")
	if err == nil {
		t.Errorf("Decrypt() expected error with wrong key, got nil")
	}
}
