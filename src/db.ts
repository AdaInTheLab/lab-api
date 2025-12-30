// src/db.ts
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { env } from "./env.js";
import { migrateLabNotesSchema, LAB_NOTES_SCHEMA_VERSION } from "./db/migrateLabNotes.js";
import {dedupeLabNotesSlugs} from "./db/migrations/2025-01-dedupe-lab-notes-slugs.js";

export function resolveDbPath(): string {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    // Default DB file paths (only used when NOT in test, and DB_PATH not provided)
    const defaultDbFile =
        env.NODE_ENV === "development"
            ? path.join(__dirname, "../data/lab.dev.db")
            : path.join(__dirname, "../data/lab.db");

    const dbPath =
        env.NODE_ENV === "test"
            ? ":memory:"
            : env.DB_PATH
                ? path.resolve(env.DB_PATH)
                : defaultDbFile;

    // Guardrail: tests must NEVER hit a file DB
    if (env.NODE_ENV === "test" && dbPath !== ":memory:") {
        throw new Error(`Refusing to run tests on file DB: ${dbPath}`);
    }

    return dbPath;
}

export function openDb(dbPath: string) {
    const verbose = process.env.DB_VERBOSE === "1" ? console.log : undefined;
    return new Database(dbPath, { verbose });
}

export function getLabNotesSchemaVersion(db: Database.Database): number {
    // Ensure meta table exists for fresh DBs
    db.exec(`
    CREATE TABLE IF NOT EXISTS schema_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

    const row = db
        .prepare(`SELECT value FROM schema_meta WHERE key = 'lab_notes_schema_version'`)
        .get() as { value?: string } | undefined;

    const n = Number(row?.value ?? 0);
    return Number.isFinite(n) ? n : 0;
}

export function setLabNotesSchemaVersion(db: Database.Database, version: number) {
    db.exec(`
    CREATE TABLE IF NOT EXISTS schema_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

    db.prepare(`
    INSERT INTO schema_meta (key, value)
    VALUES ('lab_notes_schema_version', ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value
  `).run(String(version));
}

export function bootstrapDb(db: Database.Database) {
    const log = process.env.DB_MIGRATE_VERBOSE === "1" ? console.log : undefined;

// ✅ Read prevVersion ASAP (everything below can be version-gated)
    const prevVersion = getLabNotesSchemaVersion(db);
    // ✅ Single source of truth for schema + views
    migrateLabNotesSchema(db, log);
    if (prevVersion < 3) {
        dedupeLabNotesSlugs(db, log);
    }

    // (Optional) Keep tag table here only if some routes still use it directly
    // Note: migrator also creates it, but leaving this is harmless if you want belt + suspenders.
    db.exec(`
        CREATE TABLE IF NOT EXISTS lab_note_tags (
                                                     note_id TEXT NOT NULL,
                                                     tag TEXT NOT NULL,
                                                     UNIQUE(note_id, tag)
        );
        CREATE INDEX IF NOT EXISTS idx_lab_note_tags_note_id ON lab_note_tags(note_id);
        CREATE INDEX IF NOT EXISTS idx_lab_note_tags_tag ON lab_note_tags(tag);
    `);
    setLabNotesSchemaVersion(db, LAB_NOTES_SCHEMA_VERSION)
}

function sha256Hex(input: string): string {
    return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Seeds a single marker note using the v2 ledger:
 * - lab_notes holds metadata + pointers
 * - lab_note_revisions holds markdown truth
 */
export function seedMarkerNote(db: Database.Database) {
    const nowIso = new Date().toISOString();
    const noteId = "api-marker";
    const slug = "api-marker-note";
    const locale = "en";

    // If already seeded (has current revision), do nothing.
    const existing = db.prepare(`
    SELECT current_revision_id AS cur
    FROM lab_notes
    WHERE id = ?
  `).get(noteId) as { cur?: string } | undefined;

    if (existing?.cur) return;

    // 1) Insert metadata row (idempotent)
    db.prepare(`
    INSERT OR IGNORE INTO lab_notes (
      id,
      group_id,
      slug,
      locale,

      type,
      title,

      category,
      excerpt,
      department_id,
      shadow_density,
      safer_landing,
      read_time_minutes,
      coherence_score,
      subtitle,
      summary,

      tags_json,
      dept,

      status,
      published_at,

      author,
      ai_author,

      source_locale,
      translation_status,
      translation_provider,
      translation_version,
      source_updated_at,
      translation_meta_json,

      content_html,

      current_revision_id,
      published_revision_id,

      created_at,
      updated_at
    )
    VALUES (
      ?, ?, ?, ?,
      ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?,
      ?, ?,
      ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?,
      NULL, NULL,
      ?, ?
    )
  `).run(
        noteId,
        noteId,
        slug,
        locale,

        "memo",
        "API Marker Note",

        "Debug",
        "If you can see this in WebStorm, we are looking at the same DB.",
        "SCMS",
        0.0,
        1,
        1,
        1.0,
        null,
        null,

        "[]",
        "SCMS",

        "published",
        nowIso.slice(0, 10),

        "Ada",
        "Lyric",

        null,
        "original",
        null,
        1,
        null,
        null,

        null,
        nowIso,
        nowIso
    );

    // 2) Create revision (markdown truth)
    const revisionId = crypto.randomUUID();

    const frontmatter = {
        id: noteId,
        slug,
        type: "memo",
        title: "API Marker Note",
        status: "published",
        published: nowIso.slice(0, 10),
        locale,
        dept: "SCMS",
        department_id: "SCMS",
        shadow_density: 0,
        safer_landing: true,
        tags: [],
        author: "Ada",
        ai_author: "Lyric",
    };

    const contentMarkdown =
        `---
id: "${noteId}"
slug: "${slug}"
type: "memo"
title: "API Marker Note"
dept: "SCMS"
published: "${nowIso.slice(0, 10)}"
status: "published"
locale: "en"
tags: []
summary: "If you can see this in WebStorm, we are looking at the same DB."
readingTime: 1
shadow_density: 0
safer_landing: true
---

If you can see this in WebStorm, we are looking at the same DB.
`;

    const canonical = `${JSON.stringify(frontmatter)}\n---\n${contentMarkdown}`;
    const contentHash = sha256Hex(canonical);

    db.prepare(`
    INSERT INTO lab_note_revisions (
      id, note_id, revision_num, supersedes_revision_id,
      frontmatter_json, content_markdown, content_hash,
      schema_version, source,
      intent, intent_version,
      scope_json, side_effects_json, reversible,
      auth_type, scopes_json,
      reasoning_json,
      created_at
    )
    VALUES (
      ?, ?, ?, NULL,
      ?, ?, ?,
      ?, ?,
      ?, ?,
      ?, ?, ?,
      ?, ?,
      NULL,
      ?
    )
  `).run(
        revisionId,
        noteId,
        1,
        JSON.stringify(frontmatter),
        contentMarkdown,
        contentHash,
        "0.1",
        "import",
        "seed_marker_note",
        "1",
        JSON.stringify(["db"]),
        JSON.stringify(["create"]),
        1,
        "human_session",
        JSON.stringify([]),
        nowIso
    );

    // 3) Point note at revision
    db.prepare(`
    UPDATE lab_notes
    SET current_revision_id = ?,
        published_revision_id = COALESCE(published_revision_id, ?),
        updated_at = ?
    WHERE id = ?
  `).run(revisionId, revisionId, nowIso, noteId);
}

export function isDbEmpty(db: Database.Database): boolean {
    const row = db.prepare(`SELECT COUNT(*) as count FROM lab_notes`).get() as { count: number };
    return row.count === 0;
}
