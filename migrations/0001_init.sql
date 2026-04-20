-- Initial schema. Apply with: wrangler d1 migrations apply better-changelog-db
CREATE TABLE IF NOT EXISTS entries (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  pr_number    INTEGER UNIQUE,
  commit_sha   TEXT,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL DEFAULT '',
  category     TEXT NOT NULL DEFAULT 'changed',
  author       TEXT,
  status       TEXT NOT NULL DEFAULT 'draft',
  merged_at    INTEGER,
  published_at INTEGER,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at   INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_entries_status    ON entries(status);
CREATE INDEX IF NOT EXISTS idx_entries_published ON entries(published_at DESC);

CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,
  github_login  TEXT NOT NULL,
  github_id     INTEGER NOT NULL,
  access_token  TEXT NOT NULL,
  expires_at    INTEGER NOT NULL,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
