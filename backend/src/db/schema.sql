PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS batches (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  product_type TEXT,
  line_id      INTEGER NOT NULL DEFAULT 1,
  started_at   TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at     TEXT,
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed'))
);

CREATE TABLE IF NOT EXISTS inspections (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id     INTEGER NOT NULL,
  product_type TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('good','defective')),
  confidence   REAL CHECK (confidence >= 0 AND confidence <= 1),
  defect_type  TEXT,
  line_id      INTEGER NOT NULL DEFAULT 1,
  image_path   TEXT,
  captured_at  TEXT NOT NULL DEFAULT (datetime('now')),
  size_category TEXT CHECK (size_category IN ('small','medium','large')),
  needs_review  INTEGER NOT NULL DEFAULT 0 CHECK (needs_review IN (0,1)),
  model_version TEXT, 
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);

CREATE TABLE IF NOT EXISTS alerts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id    INTEGER NOT NULL,
  type        TEXT NOT NULL,
  message     TEXT NOT NULL,
  defect_rate REAL,
  is_read     INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0,1)),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);

CREATE TABLE IF NOT EXISTS production_records (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id    INTEGER NOT NULL,
  quantity    INTEGER NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);

CREATE TABLE IF NOT EXISTS waste_records (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id    INTEGER NOT NULL,
  quantity    INTEGER NOT NULL,
  reason      TEXT,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);

CREATE TABLE IF NOT EXISTS costs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id    INTEGER NOT NULL,
  amount      REAL NOT NULL,
  category    TEXT,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);

CREATE TABLE IF NOT EXISTS revenue (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id    INTEGER NOT NULL,
  amount      REAL NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);

CREATE TABLE IF NOT EXISTS agent_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  question   TEXT NOT NULL,
  answer     TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_insp_batch    ON inspections(batch_id);
CREATE INDEX IF NOT EXISTS idx_insp_captured ON inspections(captured_at);
CREATE INDEX IF NOT EXISTS idx_alerts_read   ON alerts(is_read);

-- Performance indexes for inspection reports
CREATE INDEX IF NOT EXISTS idx_insp_captured_status
ON inspections(captured_at, status);

CREATE INDEX IF NOT EXISTS idx_insp_defect_type
ON inspections(defect_type)
WHERE status = 'defective';

-- Foreign key and batch aggregation indexes
CREATE INDEX IF NOT EXISTS idx_alerts_batch
ON alerts(batch_id);

CREATE INDEX IF NOT EXISTS idx_production_batch
ON production_records(batch_id);

CREATE INDEX IF NOT EXISTS idx_waste_batch
ON waste_records(batch_id);

CREATE INDEX IF NOT EXISTS idx_costs_batch
ON costs(batch_id);

CREATE INDEX IF NOT EXISTS idx_revenue_batch
ON revenue(batch_id);
