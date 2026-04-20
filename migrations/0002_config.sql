-- Key/value config store. All runtime config (tracked repo, prod branch, app
-- URL, webhook secret) is edited via /setup GUI rather than wrangler.jsonc.
CREATE TABLE IF NOT EXISTS config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
