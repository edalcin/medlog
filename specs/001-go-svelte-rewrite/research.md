# Research: MedLog v2 Stack (Go + Svelte 5)

## Q1 — Server-Side Session Management

**Decision:** `alexedwards/scs` v2 with `sqlite3store` backend

**Rationale:** SCS is the most actively maintained Go session library with a first-class SQLite store. Sessions are stored in the same SQLite file as app data. Bulk invalidation on backup restore is a single SQL statement: `DELETE FROM sessions`. The store uses standard `database/sql` with a `*sql.DB` — it works with any registered driver, including `modernc.org/sqlite`.

**Driver registration note:** `modernc.org/sqlite` registers under the name `"sqlite"` (not `"sqlite3"`). All places that call `sql.Open()` must use `sql.Open("sqlite", dsn)`. The `sqlite3store` accepts a `*sql.DB`, so no driver name conflict exists at the store level.

**Required schema (migration):**
```sql
CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    data  BLOB NOT NULL,
    expiry REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expiry);
```

**Alternatives considered:** `gorilla/sessions` — lacks clean bulk-invalidation path; its SQLite backend is unmaintained. Custom implementation (~80 lines) — feasible but introduces untested cookie signing and expiry cleanup.

---

## Q2 — SQL Migration Runner

**Decision:** `pressly/goose` v3 with `//go:embed`

**Rationale:** Goose has first-class embedded filesystem support via `goose.SetBaseFS(embedFS)` + `goose.Up(db, "migrations")` — two lines at startup. Supports SQLite dialect (`goose.SetDialect("sqlite3")`), uses standard `database/sql`, driver-agnostic.

**Existing database compatibility:** The current production database was migrated by Prisma and has a `_prisma_migrations` tracking table — not `goose_db_version`. Goose will see migration 001 as unapplied and attempt to run it. **All migration SQL must use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`** to be idempotent and safe against existing Prisma-created tables. The sessions table and `goose_db_version` table are truly new and will be created normally.

**Alternatives considered:** `golang-migrate/migrate` — valid alternative, also supports `iofs` embedded sources and explicitly documents `modernc.org/sqlite` support. Slightly more boilerplate (`iofs.New` + `NewWithSourceInstance`). Custom 30-line runner — loses sequential-version tracking and idempotent re-run safety.

---

## Q3 — Svelte 5 SPA Routing

**Decision:** Plain Svelte 5 + Vite 5 + `@keenmate/svelte-spa-router`, history mode

**Rationale:** `@keenmate/svelte-spa-router` is the only Svelte 5-native router (built with runes API). History mode produces clean URLs (`/consultations`, `/admin`) matching the spec's bookmark-compatibility requirement. The Go backend serves a SPA catch-all: any request that is not `/api/*` and not a static asset returns `index.html`.

**Go catch-all handler pattern:**
```go
// Any non-API, non-file path returns index.html for SPA routing
func spaHandler(staticFS embed.FS) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        // Try to serve static asset first
        content, err := staticFS.ReadFile("dist" + r.URL.Path)
        if err != nil {
            // Fall back to index.html for SPA routes
            content, _ = staticFS.ReadFile("dist/index.html")
        }
        // ... serve content
    }
}
```

**Alternatives considered:** SvelteKit 2 with `adapter-static` — produces clean output but adds build complexity, SSR configuration risk, and larger dependency surface. Hash routing — simpler but produces URLs like `/#/consultations`, breaking the spec's bookmark-compatibility requirement.

---

## Q4 — Authenticated File Serving

**Decision:** Custom handler using `http.ServeContent` with `filepath.Base()` sanitization

**Rationale:** No library needed (~25 lines). The handler verifies session via SCS, sanitizes the filename with `filepath.Base()` to prevent path traversal, opens the file, and serves it with `http.ServeContent` (handles Range requests and Content-Type correctly).

**Security requirements:**
- `filepath.Base(filename)` before joining with `FILES_PATH` — prevents `../../etc/passwd`
- `X-Content-Type-Options: nosniff` response header — prevents MIME-sniffing on user content
- Return generic 404 (not file-not-found details) on missing files
- Restrict served MIME types to `application/pdf`, `image/png`, `image/jpeg` — return 403 for anything else

**Pattern:**
```go
func (h *FileHandler) ServeFile(w http.ResponseWriter, r *http.Request) {
    userID := h.sessions.GetString(r.Context(), "userID")
    if userID == "" {
        http.Error(w, "Unauthorized", http.StatusUnauthorized)
        return
    }
    filename := filepath.Base(chi.URLParam(r, "filename"))
    path := filepath.Join(h.filesPath, filename)
    f, err := os.Open(path)
    if err != nil {
        http.NotFound(w, r)
        return
    }
    defer f.Close()
    w.Header().Set("X-Content-Type-Options", "nosniff")
    http.ServeContent(w, r, filename, time.Time{}, f)
}
```

---

## Q5 — Docker Multi-Stage Build

**Decision:** 3-stage Dockerfile: Node builder → Go builder (embeds frontend) → distroless/static

**Build order constraint:** Go binary embeds the Svelte build output via `//go:embed`. The multi-stage build must:
1. Stage 1 (node:20-alpine): Build Svelte → `frontend/dist/`
2. Stage 2 (golang:1.25-alpine): `COPY --from=frontend-builder /frontend/dist ./internal/embed/dist`, then `CGO_ENABLED=0 go build`
3. Stage 3 (gcr.io/distroless/static:nonroot): Copy binary only

**Docker HEALTHCHECK in distroless:** `distroless/static` has no curl/wget. Options: (a) embed a `/healthcheck` subcommand in the binary (`./medlog healthcheck` exits 0/1), (b) use `distroless/base` (~20 MB, has busybox). Recommended: option (a) — keeps distroless/static, adds ~0 size to binary.

**Expected final image size:** distroless/static base ~2 MB + Go binary ~15–20 MB + Svelte assets (embedded) ~5–10 MB = **~25–30 MB total**. Meets SC-001 (< 30 MB).

---

## Q6 — No-CGO Constraint Verification

`modernc.org/sqlite` is a pure-Go port of SQLite (transpiled from C via a custom tool). It requires no CGO, no system SQLite library, and compiles to a static binary. `CGO_ENABLED=0 go build` works without flags. The binary is fully compatible with `distroless/static`.

**Trade-off:** ~3–5% slower than `mattn/go-sqlite3` (CGO-based). Negligible for domestic-scale use (SC-001 constraint justifies the performance trade-off).
