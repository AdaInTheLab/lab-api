// src/db.ts
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { env } from "./env.js";
import { nowIso, sha256Hex } from './lib/helpers.js';
import { migrateLabNotesSchema, LAB_NOTES_SCHEMA_VERSION } from "./db/migrateLabNotes.js";
import {dedupeLabNotesSlugs} from "./db/migrations/2025-01-dedupe-lab-notes-slugs.js";
import { migrateApiTokensSchema } from "./db/migrateApiTokens.js";
import { createRelaySessions } from "./db/migrations/2025-01-add-relay-sessions.js";
import { up as createBridgePosts } from "./db/migrations/2025-01-28-add-bridge-posts.js";

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
    migrateApiTokensSchema(db, log);
    createRelaySessions(db, log);
    createBridgePosts(db);  // 🌉 Liminal Bridge posts table
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

/* ===========================================================
   🌱 HUMAN PATTERN LAB — MARKER NOTE SEED (BOOT-SAFE)
   -----------------------------------------------------------
   Purpose:
     Ensure the marker note exists and pointers are valid.
     This may run on every app boot and MUST be idempotent.

   Behavior:
     1) If lab_notes.current_revision_id is already set -> noop.
     2) Else if any revisions exist -> repair pointers to latest revision.
     3) Else -> create a new revision using next revision_num (safe).
   =========================================================== */
export function seedMarkerNote(db: any) {
    const now = nowIso();
    const slug = "api-marker-note";
    const locale = "en";

    // 0) Does this note already exist? (dev DB likely: yes)
    const existing = db.prepare(`
    SELECT id, current_revision_id, published_revision_id
    FROM lab_notes
    WHERE slug = ? AND locale = ?
    LIMIT 1
  `).get(slug, locale) as
        | { id: string; current_revision_id: string | null; published_revision_id: string | null }
        | undefined;

    // Canonical id you *prefer* for new DBs, but we will NOT force it on existing rows.
    const preferredId = `${slug}:${locale}`;
    const notePk = existing?.id ?? preferredId;

    // 1) Create note if missing; otherwise update fields (but never try to change its id)
    if (!existing) {
        db.prepare(`
      INSERT INTO lab_notes (
        id, group_id, slug, locale,
        status, title, category, excerpt,
        published_at, content_html
      )
      VALUES (
        @id, @group_id, @slug, @locale,
        @status, @title, @category, @excerpt,
        @published_at, @content_html
      )
    `).run({
            id: notePk,
            group_id: slug, // nice stable grouping key
            slug,
            locale,
            status: "published",
            title: "API Marker Note",
            category: "memo",
            excerpt: "Marker note used for tests and sanity checks.",
            published_at: now,
            content_html: "<h1>API Marker</h1><p>This is a seeded marker note.</p>",
        });
    } else {
        db.prepare(`
      UPDATE lab_notes
      SET
        status = 'published',
        title = COALESCE(title, 'API Marker Note'),
        category = COALESCE(category, 'memo'),
        excerpt = COALESCE(excerpt, 'Marker note used for tests and sanity checks.'),
        published_at = COALESCE(published_at, @now),
        content_html = COALESCE(content_html, @html),
        group_id = COALESCE(group_id, @group_id)
      WHERE id = @id
    `).run({
            id: notePk,
            now,
            html: "<h1>API Marker</h1><p>This is a seeded marker note.</p>",
            group_id: slug,
        });
    }

    // 2) Ensure at least one revision exists for this notePk
    const maxRow = db.prepare(`
    SELECT COALESCE(MAX(revision_num), 0) as maxRev
    FROM lab_note_revisions
    WHERE note_id = ?
  `).get(notePk) as { maxRev: number };

    if (maxRow.maxRev === 0) {
        const revId = crypto.randomUUID();
        const md = "# API Marker\n\nThis is a seeded marker note.";
        const hash = sha256Hex(md);

        db.prepare(`
      INSERT INTO lab_note_revisions (
        id,
        note_id,
        revision_num,
        supersedes_revision_id,
        frontmatter_json,
        content_markdown,
        content_hash,
        schema_version,
        source,
        intent,
        intent_version,
        scope_json,
        side_effects_json,
        reversible,
        auth_type,
        scopes_json,
        reasoning_json,
        created_at
      )
      VALUES (
        @id,
        @note_id,
        1,
        NULL,
        @frontmatter_json,
        @content_markdown,
        @content_hash,
        'v1',
        'api',
        'marker',
        1,
        '{}',
        '{}',
        1,
        'human_session',
        '[]',
        NULL,
        @created_at
      )
    `).run({
            id: revId,
            note_id: notePk, // ✅ FK-correct (lab_notes.id)
            frontmatter_json: JSON.stringify({ title: "API Marker Note", locale }),
            content_markdown: md,
            content_hash: hash,
            created_at: now,
        });
    }

    // 3) Repair pointers to latest revision (always)
    const latest = db.prepare(`
        SELECT id
        FROM lab_note_revisions
        WHERE note_id = ?
        ORDER BY revision_num DESC
        LIMIT 1
    `).get(notePk) as { id: string } | undefined;

    if (latest?.id) {
        db.prepare(`
            UPDATE lab_notes
            SET
                current_revision_id = @rid,
                published_revision_id = @rid
            WHERE id = @nid
        `).run({ rid: latest.id, nid: notePk });
    }
}


export function isDbEmpty(db: Database.Database): boolean {
    const row = db.prepare(`SELECT COUNT(*) as count FROM lab_notes`).get() as { count: number };
    return row.count === 0;
}
