package auth

import (
	"database/sql"
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
)

func InitSessions(db *sql.DB, secure bool) {
	Manager = scs.New()
	Manager.Store = sqlite3store.New(db)
	Manager.Lifetime = 7 * 24 * time.Hour
	Manager.Cookie.HttpOnly = true
	Manager.Cookie.SameSite = http.SameSiteLaxMode
	Manager.Cookie.Secure = secure
}

func InvalidateAllSessions(db *sql.DB) error {
	_, err := db.Exec("DELETE FROM sessions")
	return err
}
