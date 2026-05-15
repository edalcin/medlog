-- +goose Up
-- +goose StatementBegin

CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    username      TEXT UNIQUE,
    name          TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'USER',
    theme         TEXT NOT NULL DEFAULT 'SYSTEM',
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS specialties (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clinics (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    address    TEXT,
    user_id    TEXT REFERENCES users(id) ON DELETE CASCADE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS clinics_name_user_id_unique ON clinics(name, user_id);
CREATE INDEX IF NOT EXISTS clinics_user_id_idx ON clinics(user_id);

CREATE TABLE IF NOT EXISTS professionals (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    crm        TEXT,
    address    TEXT,
    notes      TEXT,
    is_active  INTEGER NOT NULL DEFAULT 1,
    user_id    TEXT REFERENCES users(id) ON DELETE CASCADE,
    clinic_id  TEXT REFERENCES clinics(id) ON DELETE SET NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS professionals_user_id_idx   ON professionals(user_id);
CREATE INDEX IF NOT EXISTS professionals_clinic_id_idx ON professionals(clinic_id);

CREATE TABLE IF NOT EXISTS professional_specialties (
    id              TEXT PRIMARY KEY,
    professional_id TEXT NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
    specialty_id    TEXT NOT NULL REFERENCES specialties(id)   ON DELETE CASCADE,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (professional_id, specialty_id)
);
CREATE INDEX IF NOT EXISTS professional_specialties_specialty_id_idx ON professional_specialties(specialty_id);

CREATE TABLE IF NOT EXISTS phones (
    id              TEXT PRIMARY KEY,
    number          TEXT NOT NULL,
    label           TEXT,
    professional_id TEXT REFERENCES professionals(id) ON DELETE CASCADE,
    clinic_id       TEXT REFERENCES clinics(id)       ON DELETE CASCADE,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS phones_professional_id_idx ON phones(professional_id);
CREATE INDEX IF NOT EXISTS phones_clinic_id_idx       ON phones(clinic_id);

CREATE TABLE IF NOT EXISTS consultations (
    id              TEXT PRIMARY KEY,
    date            DATETIME NOT NULL,
    proposito       TEXT,
    notes           TEXT,
    type            TEXT NOT NULL DEFAULT 'CONSULTATION',
    rating          INTEGER,
    user_id         TEXT NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
    professional_id TEXT         REFERENCES professionals(id)  ON DELETE SET NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS consultations_user_id_idx         ON consultations(user_id);
CREATE INDEX IF NOT EXISTS consultations_professional_id_idx ON consultations(professional_id);
CREATE INDEX IF NOT EXISTS consultations_date_idx            ON consultations(date DESC);

CREATE TABLE IF NOT EXISTS file_categories (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS files (
    id               TEXT PRIMARY KEY,
    filename         TEXT NOT NULL,
    custom_name      TEXT,
    path             TEXT NOT NULL,
    mime_type        TEXT NOT NULL,
    size             INTEGER NOT NULL,
    hash             TEXT,
    thumbnail_path   TEXT,
    consultation_id  TEXT REFERENCES consultations(id)  ON DELETE CASCADE,
    professional_id  TEXT REFERENCES professionals(id)  ON DELETE SET NULL,
    user_id          TEXT REFERENCES users(id)          ON DELETE CASCADE,
    uploaded_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS files_consultation_id_idx  ON files(consultation_id);
CREATE INDEX IF NOT EXISTS files_professional_id_idx  ON files(professional_id);
CREATE INDEX IF NOT EXISTS files_user_id_idx          ON files(user_id);

CREATE TABLE IF NOT EXISTS file_file_categories (
    id          TEXT PRIMARY KEY,
    file_id     TEXT NOT NULL REFERENCES files(id)          ON DELETE CASCADE,
    category_id TEXT NOT NULL REFERENCES file_categories(id) ON DELETE CASCADE,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (file_id, category_id)
);
CREATE INDEX IF NOT EXISTS file_file_categories_category_id_idx ON file_file_categories(category_id);

CREATE TABLE IF NOT EXISTS user_professional_sharing (
    id                   TEXT PRIMARY KEY,
    sharing_from_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sharing_to_user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (sharing_from_user_id, sharing_to_user_id)
);
CREATE INDEX IF NOT EXISTS user_professional_sharing_to_idx ON user_professional_sharing(sharing_to_user_id);

CREATE TABLE IF NOT EXISTS user_clinic_sharing (
    id                   TEXT PRIMARY KEY,
    sharing_from_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sharing_to_user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (sharing_from_user_id, sharing_to_user_id)
);
CREATE INDEX IF NOT EXISTS user_clinic_sharing_to_idx ON user_clinic_sharing(sharing_to_user_id);

CREATE TABLE IF NOT EXISTS login_logs (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_name  TEXT NOT NULL,
    user_email TEXT NOT NULL,
    timestamp  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS login_logs_user_id_idx   ON login_logs(user_id);
CREATE INDEX IF NOT EXISTS login_logs_timestamp_idx ON login_logs(timestamp);

-- +goose StatementEnd

-- +goose Down
DROP TABLE IF EXISTS login_logs;
DROP TABLE IF EXISTS user_clinic_sharing;
DROP TABLE IF EXISTS user_professional_sharing;
DROP TABLE IF EXISTS file_file_categories;
DROP TABLE IF EXISTS files;
DROP TABLE IF EXISTS file_categories;
DROP TABLE IF EXISTS consultations;
DROP TABLE IF EXISTS phones;
DROP TABLE IF EXISTS professional_specialties;
DROP TABLE IF EXISTS professionals;
DROP TABLE IF EXISTS clinics;
DROP TABLE IF EXISTS specialties;
DROP TABLE IF EXISTS users;
