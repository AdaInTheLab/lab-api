// src/db.ts
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "./env.js";
import { migrateLabNotesSchema } from "./db/migrateLabNotes.js";

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

export function bootstrapDb(db: Database.Database) {
    const log = process.env.DB_MIGRATE_VERBOSE === "1" ? console.log : undefined;
    migrateLabNotesSchema(db, log);
    db.exec(`
        CREATE TABLE IF NOT EXISTS lab_notes (
          id TEXT PRIMARY KEY,                 -- uuid per row
          group_id TEXT NOT NULL,              -- uuid shared across translations
          slug TEXT NOT NULL,
          locale TEXT NOT NULL DEFAULT 'en',

          type TEXT NOT NULL DEFAULT 'labnote', -- labnote|paper|memo
          title TEXT NOT NULL,

          -- MVP core (kept)
          category TEXT,
          excerpt TEXT,
          department_id TEXT,
          shadow_density REAL,
          safer_landing INTEGER,               -- 0/1
          read_time_minutes INTEGER,

          coherence_score REAL,
          subtitle TEXT,
          summary TEXT,

          tags_json TEXT,                      -- optional JSON array string
          dept TEXT,                           -- optional convenience label

          status TEXT NOT NULL DEFAULT 'draft', -- draft|published|archived
          published_at TEXT,

          author TEXT,
          ai_author TEXT,

          -- Translation metadata
          source_locale TEXT,
          translation_status TEXT NOT NULL DEFAULT 'original', -- original|machine|human|needs_review
          translation_provider TEXT,
          translation_version INTEGER NOT NULL DEFAULT 1,
          source_updated_at TEXT,
          translation_meta_json TEXT,

          -- Canonical markdown
          content_md TEXT NOT NULL,
          content_html TEXT,

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,

          UNIQUE (group_id, locale),
          UNIQUE (slug, locale)
        );

        CREATE INDEX IF NOT EXISTS idx_lab_notes_locale ON lab_notes(locale);
        CREATE INDEX IF NOT EXISTS idx_lab_notes_status ON lab_notes(status);
        CREATE INDEX IF NOT EXISTS idx_lab_notes_published_at ON lab_notes(published_at);
        CREATE INDEX IF NOT EXISTS idx_lab_notes_group_id ON lab_notes(group_id);
        CREATE INDEX IF NOT EXISTS idx_lab_notes_department_id ON lab_notes(department_id);

        DROP VIEW IF EXISTS v_lab_notes;

        CREATE VIEW v_lab_notes AS
        SELECT
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

            content_md,
            content_html,

            created_at,
            updated_at
        FROM lab_notes;
    `);

    // Optional: keep the tag table if anything still uses it
    db.exec(`
        CREATE TABLE IF NOT EXISTS lab_note_tags (
            note_id TEXT NOT NULL,
            tag TEXT NOT NULL,
            UNIQUE(note_id, tag)
        );
        CREATE INDEX IF NOT EXISTS idx_lab_note_tags_note_id ON lab_note_tags(note_id);
        CREATE INDEX IF NOT EXISTS idx_lab_note_tags_tag ON lab_note_tags(tag);
    `);
}

export function seedMarkerNote(db: Database.Database) {
    const now = new Date();
    const nowIso = now.toISOString();

    db.prepare(`
        INSERT OR IGNORE INTO lab_notes (
            id, group_id, title, slug, locale, type,
            category, excerpt, department_id,
            shadow_density, safer_landing, read_time_minutes, coherence_score,
            status, published_at,
            author, ai_author,
            translation_status,
            content_md, content_html,
            created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        "api-marker",
        "api-marker",
        "API Marker Note",
        "api-marker-note",
        "en",
        "memo",
        "Debug",
        "If you can see this in WebStorm, we are looking at the same DB.",
        "SCMS",
        0.0,
        1,
        1,
        1.0,
        "draft",
        nowIso.slice(0, 10),
        "Ada",
        "Lyric",
        "original",
        "If you can see this in WebStorm, we are looking at the same DB.",
        null,
        nowIso,
        nowIso
    );
}

export function isDbEmpty(db: Database.Database): boolean {
    const row = db.prepare(`SELECT COUNT(*) as count FROM lab_notes`).get() as { count: number };
    return row.count === 0;
}

