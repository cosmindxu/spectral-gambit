-- Spectral Gambit — D1 schema (also used verbatim by the local dev shim).

-- Correspondence (async human-vs-human) games. The full machine state
-- lives in `szx` (base64); turns are enforced by per-side tokens.
CREATE TABLE IF NOT EXISTS games (
  id          TEXT PRIMARY KEY,
  mode        TEXT NOT NULL DEFAULT 'h2h',
  status      TEXT NOT NULL DEFAULT 'waiting',   -- waiting | active | over
  turn        TEXT NOT NULL DEFAULT 'white',     -- white | black
  white_name  TEXT,
  black_name  TEXT,
  white_token TEXT,
  black_token TEXT,
  szx         TEXT,                              -- base64 .szx snapshot
  movelog     TEXT NOT NULL DEFAULT '[]',        -- JSON array of {san,side,...}
  result      TEXT,                              -- e.g. '1-0','0-1','1/2'
  created_at  INTEGER,
  updated_at  INTEGER
);

-- Engine-ladder results: one row per finished game vs the AI.
CREATE TABLE IF NOT EXISTS ladder (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  level      INTEGER NOT NULL,                   -- engine strength 1..5
  result     TEXT NOT NULL,                      -- win | loss | draw
  moves      INTEGER,
  created_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_ladder_name  ON ladder(name);
CREATE INDEX IF NOT EXISTS idx_games_updated ON games(updated_at);
