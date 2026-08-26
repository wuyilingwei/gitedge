PRAGMA foreign_keys = ON;

ALTER TABLE users ADD COLUMN group_key TEXT NOT NULL DEFAULT 'free';
