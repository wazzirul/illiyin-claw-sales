# Step 6.1 — SQLite Connection & Migration

## Goal
Open database and run schema migration on startup.

## File
- `src/state/sqlite.js`

## Functions
```js
export function openDatabase(dbPath)
export function migrateDatabase(db)
```

## Schema
```sql
CREATE TABLE IF NOT EXISTS upwork_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dedup_key TEXT NOT NULL UNIQUE,
  external_job_id TEXT,
  upwork_url TEXT,
  vollna_url TEXT,
  title TEXT NOT NULL,
  job_type TEXT,
  fixed_budget_usd INTEGER,
  hourly_min_usd REAL,
  hourly_max_usd REAL,
  payment_verified TEXT,
  filter_status TEXT NOT NULL,
  score INTEGER,
  priority TEXT,
  notion_page_id TEXT,
  telegram_message_id TEXT,
  bid_status TEXT DEFAULT 'new',
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  raw_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notified_keys (
  dedup_key TEXT NOT NULL UNIQUE,
  message_id TEXT,
  notified_at TEXT NOT NULL
);
```

## Requirements
- Use `better-sqlite3`.
- `openDatabase` creates directories if missing.
- `migrateDatabase` is idempotent (CREATE IF NOT EXISTS).
- Enable WAL mode for concurrent reads.

## Verification
```bash
node -e "import('./src/state/sqlite.js').then(m => { const db = m.openDatabase('./data/test.sqlite'); m.migrateDatabase(db); console.log('ok'); db.close(); })"
```
