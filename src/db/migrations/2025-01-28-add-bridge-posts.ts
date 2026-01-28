import type { Database } from "better-sqlite3";

/**
 * Migration: Add bridge_posts table
 *
 * This table stores posts that are relayed through the Liminal Bridge system,
 * allowing AI collaborators with credential restrictions to post Lab Notes
 * autonomously through a relay mechanism.
 */

export const up = (db: Database) => {
    db.exec(`
    CREATE TABLE IF NOT EXISTS bridge_posts (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      voice TEXT NOT NULL,
      relay_session_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      posted_at TEXT,
      status TEXT DEFAULT 'pending',
      FOREIGN KEY (relay_session_id) REFERENCES relay_sessions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_bridge_posts_voice ON bridge_posts(voice);
    CREATE INDEX IF NOT EXISTS idx_bridge_posts_status ON bridge_posts(status);
    CREATE INDEX IF NOT EXISTS idx_bridge_posts_relay_session ON bridge_posts(relay_session_id);
  `);
};

export const down = (db: Database) => {
    db.exec(`
    DROP TABLE IF EXISTS bridge_posts;
  `);
};