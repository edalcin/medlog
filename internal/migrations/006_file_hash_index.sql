-- +goose Up
-- Supports the new upload-time dedup check (WHERE f.hash=? AND f.user_id=?)
-- introduced alongside FileFindByHash / FileBackfillHashes.
CREATE INDEX IF NOT EXISTS files_user_id_hash_idx ON files(user_id, hash);

-- +goose Down
DROP INDEX IF EXISTS files_user_id_hash_idx;
