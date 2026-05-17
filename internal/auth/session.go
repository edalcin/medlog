package auth

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"net/http"
	"time"

	"github.com/alexedwards/scs/sqlite3store"
	"github.com/alexedwards/scs/v2"
)

var Manager *scs.SessionManager

const (
	SessionKeyUserID = "userID"
	SessionKeyRole   = "role"
	SessionKeyName   = "name"
	SessionKeyEmail  = "email"
	SessionKeyTheme  = "theme"
)

func InitSessions(db *sql.DB, secure bool) {
	Manager = scs.New()
	Manager.Store = sqlite3store.New(db)
	Manager.Lifetime = 7 * 24 * time.Hour
	Manager.Cookie.HttpOnly = true
	Manager.Cookie.SameSite = http.SameSiteLaxMode
	Manager.Cookie.Secure = secure
}

// EnsureSessionSecret hashes the provided secret and compares it against the
// stored hash in app_config. If the secret changed (or this is the first run),
// all active sessions are invalidated so stale cookies cannot be reused.
func EnsureSessionSecret(db *sql.DB, secret string) error {
	sum := sha256.Sum256([]byte(secret))
	hash := hex.EncodeToString(sum[:])

	var stored string
	err := db.QueryRow("SELECT value FROM app_config WHERE key='session_secret_hash'").Scan(&stored)
	if err == sql.ErrNoRows {
		_, err = db.Exec("INSERT INTO app_config (key, value) VALUES ('session_secret_hash', ?)", hash)
		return err
	}
	if err != nil {
		return err
	}
	if stored == hash {
		return nil
	}
	// Secret rotated — invalidate all sessions then update stored hash.
	if err := InvalidateAllSessions(db); err != nil {
		return err
	}
	_, err = db.Exec("UPDATE app_config SET value=? WHERE key='session_secret_hash'", hash)
	return err
}

func InvalidateAllSessions(db *sql.DB) error {
	_, err := db.Exec("DELETE FROM sessions")
	return err
}
