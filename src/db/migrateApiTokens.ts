// src/db/migrateApiTokens.ts
import Database from "better-sqlite3";

export const API_TOKENS_SCHEMA_VERSION = 1;

function getVersion(db: Database.Database): number {
    const row = db
        .prepare(`SELECT value FROM schema_meta WHERE key='api_tokens_schema_version'`)
        .get() as { value?: string } | undefined;
    return row?.value ? Number(row.value) : 0;
}

function setVersion(db: Database.Database, version: number) {
    db.prepare(`
    INSERT INTO schema_meta (key, value)
    VALUES ('api_tokens_schema_version', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(String(version));
}

export function migrateApiTokensSchema(db: Database.Database, log: ((...data: any[]) => void) | undefined) {
    // Ensure schema_meta exists
    db.exec(`
    CREATE TABLE IF NOT EXISTS schema_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

    const prev = getVersion(db);
    if (prev >= API_TOKENS_SCHEMA_VERSION) return;

    db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS api_tokens (
      id TEXT PRIMARY KEY,

      label TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,

      scopes_json TEXT NOT NULL DEFAULT '[]',

      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
      expires_at TEXT NULL,

      created_by_user TEXT NULL,

      last_used_at TEXT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE INDEX IF NOT EXISTS idx_api_tokens_active ON api_tokens(is_active);
    CREATE INDEX IF NOT EXISTS idx_api_tokens_expires ON api_tokens(expires_at);
    CREATE INDEX IF NOT EXISTS idx_api_tokens_last_used ON api_tokens(last_used_at);
  `);

    setVersion(db, API_TOKENS_SCHEMA_VERSION);
}
