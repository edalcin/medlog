-- Add hash field to files table for duplicate detection
ALTER TABLE `files` ADD COLUMN `hash` VARCHAR(64) UNIQUE;

-- Create index on hash for better query performance
CREATE INDEX `files_hash_idx` ON `files`(`hash`);
