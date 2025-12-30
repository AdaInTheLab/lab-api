// src/db/migrations/2025-01-dedupe-lab-notes-slugs.ts
import type Database from "better-sqlite3";

export function dedupeLabNotesSlugs(db: Database.Database, log = console.log) {
    if (process.env.NODE_ENV !== "test") console.log("🧹 Dedupe...");

    db.exec(`
    DELETE FROM lab_notes
    WHERE id IN (
      SELECT id FROM (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY slug
            ORDER BY updated_at DESC, created_at DESC
          ) AS rn
        FROM lab_notes
      )
      WHERE rn > 1
    );
  `);

    db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_lab_notes_slug
    ON lab_notes(slug);
  `);
}
