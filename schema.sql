PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  source TEXT,
  content TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_feedback_created_at
  ON feedback (created_at DESC);

CREATE TABLE IF NOT EXISTS analysis (
  id TEXT PRIMARY KEY,
  feedback_id TEXT NOT NULL,
  status TEXT NOT NULL,              -- e.g. queued | running | done | failed
  priority INTEGER NOT NULL DEFAULT 0,
  score INTEGER,
  signals_json TEXT,
  queued_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  started_at TEXT,
  completed_at TEXT,
  result_json TEXT,
  error_text TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (feedback_id) REFERENCES feedback(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_analysis_feedback_id
  ON analysis (feedback_id);

CREATE INDEX IF NOT EXISTS idx_analysis_queue_sort
  ON analysis (status, priority DESC, queued_at ASC);

CREATE INDEX IF NOT EXISTS idx_analysis_updated_at
  ON analysis (updated_at DESC);

CREATE TABLE IF NOT EXISTS overrides (
  id TEXT PRIMARY KEY,
  analysis_id TEXT NOT NULL,
  actor TEXT,
  action TEXT NOT NULL,              -- e.g. approve | reject | rerun | set_status
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (analysis_id) REFERENCES analysis(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_overrides_analysis_id_created_at
  ON overrides (analysis_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_overrides_created_at
  ON overrides (created_at DESC);
