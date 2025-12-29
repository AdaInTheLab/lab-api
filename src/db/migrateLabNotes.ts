// src/db/migrateLabNotes.ts
import Database from "better-sqlite3";

const LAB_NOTES_SCHEMA_VERSION = 1;

function getLabNotesSchemaVersion(db: Database.Database): number {
    const row = db
        .prepare(`SELECT value FROM schema_meta WHERE key='lab_notes_schema_version'`)
        .get() as { value?: string } | undefined;

    return row?.value ? Number(row.value) : 0;
}

function setLabNotesSchemaVersion(db: Database.Database, version: number) {
    db.prepare(`
    INSERT INTO schema_meta (key, value)
    VALUES ('lab_notes_schema_version', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(String(version));
}


type ColDef = { name: string; ddl: string };
type MigrationLogFn = (msg: string) => void;

export type MigrationResult = {
    addedColumns: string[];
    createdFreshTable: boolean;
};

const LAB_NOTES_REQUIRED_COLS: ColDef[] = [
    // Core identity
    { name: "group_id", ddl: "TEXT NOT NULL DEFAULT ''" },
    { name: "slug", ddl: "TEXT NOT NULL DEFAULT ''" },
    { name: "locale", ddl: "TEXT NOT NULL DEFAULT 'en'" },

    // Basics
    { name: "type", ddl: "TEXT NOT NULL DEFAULT 'labnote'" },
    { name: "title", ddl: "TEXT NOT NULL DEFAULT ''" },

    // Kept attributes
    { name: "category", ddl: "TEXT" },
    { name: "excerpt", ddl: "TEXT" },
    { name: "department_id", ddl: "TEXT" },
    { name: "shadow_density", ddl: "REAL" },
    { name: "safer_landing", ddl: "INTEGER" },
    { name: "read_time_minutes", ddl: "INTEGER" },

    { name: "coherence_score", ddl: "REAL" },
    { name: "subtitle", ddl: "TEXT" },
    { name: "summary", ddl: "TEXT" },

    { name: "tags_json", ddl: "TEXT" },
    { name: "dept", ddl: "TEXT" },

    // Publishing
    { name: "status", ddl: "TEXT NOT NULL DEFAULT 'draft'" },
    { name: "published_at", ddl: "TEXT" },

    // Authors
    { name: "author", ddl: "TEXT" },
    { name: "ai_author", ddl: "TEXT" },

    // Translation metadata
    { name: "source_locale", ddl: "TEXT" },
    { name: "translation_status", ddl: "TEXT NOT NULL DEFAULT 'original'" },
    { name: "translation_provider", ddl: "TEXT" },
    { name: "translation_version", ddl: "INTEGER NOT NULL DEFAULT 1" },
    { name: "source_updated_at", ddl: "TEXT" },
    { name: "translation_meta_json", ddl: "TEXT" },

    // Content
    { name: "content_md", ddl: "TEXT NOT NULL DEFAULT ''" },
    { name: "content_html", ddl: "TEXT" },

    // Timestamps
    { name: "created_at", ddl: "TEXT NOT NULL DEFAULT ''" },
    { name: "updated_at", ddl: "TEXT NOT NULL DEFAULT ''" },
];

export function migrateLabNotesSchema(
    db: Database.Database,
    log?: MigrationLogFn
): MigrationResult {
    // Did the table exist before?
    const hadLabNotesTable = !!db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='lab_notes'`)
        .get();

    // Ensure table exists (minimal seed)
    db.exec(`
        CREATE TABLE IF NOT EXISTS lab_notes (
                                                 id TEXT PRIMARY KEY
        );
    `);

    const existingCols = new Set<string>(
        db.prepare(`PRAGMA table_info(lab_notes)`).all().map((r: any) => r.name)
    );

    const addedColumns: string[] = [];

    for (const col of LAB_NOTES_REQUIRED_COLS) {
        if (!existingCols.has(col.name)) {
            db.exec(`ALTER TABLE lab_notes ADD COLUMN ${col.name} ${col.ddl};`);
            addedColumns.push(col.name);
        }
    }

    db.exec(`
        CREATE TABLE IF NOT EXISTS schema_meta (
                                                   key TEXT PRIMARY KEY,
                                                   value TEXT NOT NULL
        );
    `);

    const prevVersion = getLabNotesSchemaVersion(db);
    // Backfills for legacy rows
    db.exec(`
        UPDATE lab_notes
        SET group_id = id
        WHERE group_id IS NULL OR group_id = '';

        UPDATE lab_notes SET slug = id WHERE slug IS NULL OR slug = '';
        UPDATE lab_notes SET title = slug WHERE title IS NULL OR title = '';
        UPDATE lab_notes SET content_md = '' WHERE content_md IS NULL;

        UPDATE lab_notes
        SET created_at = COALESCE(created_at, updated_at, datetime('now'))
        WHERE created_at IS NULL OR created_at = '';

        UPDATE lab_notes
        SET updated_at = COALESCE(updated_at, created_at, datetime('now'))
        WHERE updated_at IS NULL OR updated_at = '';
    `);

    // Indexes + view (idempotent)
    db.exec(`
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

    // Optional tag table
    db.exec(`
        CREATE TABLE IF NOT EXISTS lab_note_tags (
            note_id TEXT NOT NULL,
            tag TEXT NOT NULL,
            UNIQUE(note_id, tag)
        );
        CREATE INDEX IF NOT EXISTS idx_lab_note_tags_note_id ON lab_note_tags(note_id);
        CREATE INDEX IF NOT EXISTS idx_lab_note_tags_tag ON lab_note_tags(tag);
    `);

    const result: MigrationResult = {
        addedColumns,
        createdFreshTable: !hadLabNotesTable,
    };

    if (log && (result.createdFreshTable || result.addedColumns.length > 0 || prevVersion !== LAB_NOTES_SCHEMA_VERSION)) {
        const colsPart =
            result.addedColumns.length > 0
                ? `added ${result.addedColumns.length} column(s): ${result.addedColumns.join(", ")}`
                : "no column changes";

        log(`[db] lab_notes migration: v${prevVersion} → v${LAB_NOTES_SCHEMA_VERSION}; ${colsPart}`);
    }

    setLabNotesSchemaVersion(db, LAB_NOTES_SCHEMA_VERSION);
    return result;
}
