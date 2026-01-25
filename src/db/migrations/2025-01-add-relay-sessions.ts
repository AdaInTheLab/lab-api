// Migration: Add relay sessions table for Hallway Architecture
import type Database from "better-sqlite3";

export function createRelaySessions(db: Database.Database, log?: typeof console.log) {
  log?.("📝 Creating relay_sessions table...");

  db.exec(`
    CREATE TABLE IF NOT EXISTS relay_sessions (
      id TEXT PRIMARY KEY,
      voice TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NOT NULL,
      used BOOLEAN NOT NULL DEFAULT 0,
      used_at TIMESTAMP,
      created_by TEXT NOT NULL DEFAULT 'admin'
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_relay_voice ON relay_sessions(voice);
    CREATE INDEX IF NOT EXISTS idx_relay_expires ON relay_sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_relay_used ON relay_sessions(used);
  `);

  log?.("✓ relay_sessions table created");
}
