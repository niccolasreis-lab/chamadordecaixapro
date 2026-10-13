CREATE TABLE IF NOT EXISTS customers (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 token_hash TEXT NOT NULL UNIQUE,
 status TEXT NOT NULL CHECK(status IN ('active','blocked')),
 expires_at TEXT,
 reason TEXT NOT NULL DEFAULT '',
 updated_at TEXT NOT NULL,
 last_seen_at TEXT
);
CREATE TABLE IF NOT EXISTS audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 customer_id TEXT NOT NULL REFERENCES customers(id),
 action TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_customer ON audit(customer_id, id);
