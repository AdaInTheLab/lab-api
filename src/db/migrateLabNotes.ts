// src/db/migrateLabNotes.ts
import Database from "better-sqlite3";
import crypto from "crypto";
/**
 * migrateLabNotesSchema
 *
 * Responsibilities:
 * - Ensure lab_notes is an identity + pointer table
 * - Ensure lab_note_revisions is the sole content truth
 * - Ensure views NEVER treat lab_notes.content_html as authoritative
 *
 * Non-responsibilities:
 * - Rendering markdown to HTML
 * - Business logic for publish/unpublish
 * - Auth decisions
 *
 * If content appears stale or "reverts", check views FIRST.
 */

export const LAB_NOTES_SCHEMA_VERSION = 11;

function setLabNotesSchemaVersion(db: Database.Database, version: number) {
    const cur = db
        .prepare(`SELECT value FROM schema_meta WHERE key='lab_notes_schema_version'`)
        .get() as { value?: string } | undefined;

    if (cur?.value === String(version)) return;

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
    ranV2DataMigration: boolean;
};

function sha256Hex(input: string): string {
    return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

function nowIso(): string {
    return new Date().toISOString();
}

function getLabNotesSchemaVersion(db: Database.Database): number {
    const row = db
        .prepare(`SELECT value FROM schema_meta WHERE key='lab_notes_schema_version'`)
        .get() as { value?: string } | undefined;

    return row?.value ? Number(row.value) : 0;
}


/**
 * v2 model: lab_notes (identity + pointers) + lab_note_revisions (append-only truth)
 *
 * This migrator is intentionally idempotent:
 * - CREATE TABLE IF NOT EXISTS
 * - CREATE INDEX IF NOT EXISTS
 * - ALTER TABLE ADD COLUMN only when missing
 *
 * For installs that had v1's wide `lab_notes` table, we:
 * - keep the existing columns (non-destructive)
 * - add v2 pointer columns
 * - create v2 tables
 * - perform a one-time migration to create revision_num=1 records and set pointers
 */

export function migrateLabNotesSchema(

    db: Database.Database,
    log?: MigrationLogFn
): MigrationResult {
    // Did the table exist before?
    const hadLabNotesTable = !!db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='lab_notes'`)
        .get();

    // Ensure schema_meta exists early (we read it before doing versioned work)
    db.exec(`
        CREATE TABLE IF NOT EXISTS schema_meta (
                                                   key TEXT PRIMARY KEY,
                                                   value TEXT NOT NULL
        );
    `);

    // Ensure lab_notes exists (seed)
    db.exec(`
        CREATE TABLE IF NOT EXISTS lab_notes (
                                                 id TEXT PRIMARY KEY
        );
    `);
    const prevVersion = getLabNotesSchemaVersion(db);
    // --- v1 compatibility columns (existing wide model) ---
    // Keep your original columns so older code / existing rows remain valid.
    // We also add the v2 pointer columns and some core identity fields needed for 1.0.
    const LAB_NOTES_REQUIRED_COLS: ColDef[] = [
        // Core identity (v1 already had these; keep enforcing)
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
        { name: "card_style", ddl: "TEXT" },

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

        // Content artifacts (no legacy markdown column anymore)
        { name: "content_html", ddl: "TEXT" },

        // Timestamps
        { name: "created_at", ddl: "TEXT NOT NULL DEFAULT ''" },
        { name: "updated_at", ddl: "TEXT NOT NULL DEFAULT ''" },

        // ---- v2 pointer fields (new) ----
        { name: "current_revision_id", ddl: "TEXT" },
        { name: "published_revision_id", ddl: "TEXT" },
    ];

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

    // Backfills for legacy rows
    db.exec(`
        UPDATE lab_notes
        SET group_id = id
        WHERE group_id IS NULL OR group_id = '';

        UPDATE lab_notes SET slug = id WHERE slug IS NULL OR slug = '';
        UPDATE lab_notes SET title = slug WHERE title IS NULL OR title = '';

        UPDATE lab_notes
        SET created_at = COALESCE(created_at, updated_at, datetime('now'))
        WHERE created_at IS NULL OR created_at = '';

        UPDATE lab_notes
        SET updated_at = COALESCE(updated_at, created_at, datetime('now'))
        WHERE updated_at IS NULL OR updated_at = '';
    `);

    // Indexes (idempotent)
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_lab_notes_locale ON lab_notes(locale);
        CREATE INDEX IF NOT EXISTS idx_lab_notes_status ON lab_notes(status);
        CREATE INDEX IF NOT EXISTS idx_lab_notes_published_at ON lab_notes(published_at);
        CREATE INDEX IF NOT EXISTS idx_lab_notes_group_id ON lab_notes(group_id);
        CREATE INDEX IF NOT EXISTS idx_lab_notes_department_id ON lab_notes(department_id);
        CREATE INDEX IF NOT EXISTS idx_lab_notes_slug_locale ON lab_notes(slug, locale);
    `);

    // Optional tag table (normalized tags)
    db.exec(`
        CREATE TABLE IF NOT EXISTS lab_note_tags (
                                                     note_id TEXT NOT NULL,
                                                     tag TEXT NOT NULL,
                                                     UNIQUE(note_id, tag)
        );
        CREATE INDEX IF NOT EXISTS idx_lab_note_tags_note_id ON lab_note_tags(note_id);
        CREATE INDEX IF NOT EXISTS idx_lab_note_tags_tag ON lab_note_tags(tag);
    `);

    // ---- v2 tables: append-only revisions + proposals + events ----
    db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS lab_note_revisions (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL,

      revision_num INTEGER NOT NULL,
      supersedes_revision_id TEXT NULL,

      frontmatter_json TEXT NOT NULL,
      content_markdown TEXT NOT NULL,
      content_hash TEXT NOT NULL,

      schema_version TEXT NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('cli','web','api','import')),

      intent TEXT NOT NULL,
      intent_version TEXT NOT NULL DEFAULT '1',

      scope_json TEXT NOT NULL DEFAULT '[]',
      side_effects_json TEXT NOT NULL DEFAULT '[]',
      reversible INTEGER NOT NULL DEFAULT 1 CHECK (reversible IN (0,1)),

      auth_type TEXT NOT NULL CHECK (auth_type IN ('human_session','lab_token')),
      scopes_json TEXT NOT NULL DEFAULT '[]',

      reasoning_json TEXT NULL,

      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

      UNIQUE (note_id, revision_num),

      FOREIGN KEY (note_id) REFERENCES lab_notes(id) ON DELETE CASCADE,
      FOREIGN KEY (supersedes_revision_id) REFERENCES lab_note_revisions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_revisions_note ON lab_note_revisions(note_id);
    CREATE INDEX IF NOT EXISTS idx_revisions_intent ON lab_note_revisions(intent);
    CREATE INDEX IF NOT EXISTS idx_revisions_hash ON lab_note_revisions(content_hash);

    CREATE TABLE IF NOT EXISTS lab_note_proposals (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL,

      base_revision_id TEXT NOT NULL,
      proposed_revision_id TEXT NOT NULL,

      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','accepted','rejected','withdrawn')),

      created_by TEXT NOT NULL,
      created_by_type TEXT NOT NULL CHECK (created_by_type IN ('human','ai','system')),

      reviewed_by TEXT NULL,
      reviewed_at TEXT NULL,
      review_comment TEXT NULL,

      diff_patch TEXT NULL,

      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

      FOREIGN KEY (note_id) REFERENCES lab_notes(id) ON DELETE CASCADE,
      FOREIGN KEY (base_revision_id) REFERENCES lab_note_revisions(id),
      FOREIGN KEY (proposed_revision_id) REFERENCES lab_note_revisions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_proposals_note ON lab_note_proposals(note_id);
    CREATE INDEX IF NOT EXISTS idx_proposals_status ON lab_note_proposals(status);

    CREATE TABLE IF NOT EXISTS lab_events (
      id TEXT PRIMARY KEY,

      event_type TEXT NOT NULL,
      note_id TEXT NULL,
      revision_id TEXT NULL,
      proposal_id TEXT NULL,

      intent TEXT NULL,
      intent_version TEXT NULL,

      actor_type TEXT NOT NULL CHECK (actor_type IN ('human','ai','system')),
      actor_id TEXT NOT NULL,

      auth_type TEXT NULL CHECK (auth_type IN ('human_session','lab_token')),
      scopes_json TEXT NULL,

      payload_json TEXT NOT NULL DEFAULT '{}',

      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

      FOREIGN KEY (note_id) REFERENCES lab_notes(id) ON DELETE SET NULL,
      FOREIGN KEY (revision_id) REFERENCES lab_note_revisions(id) ON DELETE SET NULL,
      FOREIGN KEY (proposal_id) REFERENCES lab_note_proposals(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_events_type ON lab_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_events_note ON lab_events(note_id);
    CREATE INDEX IF NOT EXISTS idx_events_created_at ON lab_events(created_at);
  `);

    let ranV2DataMigration = false;

    // ---- v2 data migration (one-time) ----
    if (prevVersion < 2) {
        // ---- v2 data migration (legacy installs only) ----
        // NOTE:
        // This migration was used during early v2 rollout.
        // New installs and modern DBs rely on seedMarkerNote + admin writes.
        // Intentionally left as a no-op placeholder for schema history clarity.
                let ranV2DataMigration = false;
    }

    // ---- drop legacy markdown column (table rebuild) ----
    if (prevVersion < 7) {
        db.exec(`
      PRAGMA foreign_keys = OFF;

      BEGIN;

      DROP VIEW IF EXISTS v_lab_notes;
      DROP VIEW IF EXISTS v_lab_notes_current;

      DROP TABLE IF EXISTS lab_notes_new;

      CREATE TABLE lab_notes_new (
        id TEXT PRIMARY KEY,

        group_id TEXT NOT NULL,
        slug TEXT NOT NULL,
        locale TEXT NOT NULL,

        type TEXT NOT NULL,
        title TEXT NOT NULL,

        category TEXT,
        excerpt TEXT,
        department_id TEXT,
        shadow_density REAL,
        safer_landing INTEGER,
        read_time_minutes INTEGER,

        coherence_score REAL,
        subtitle TEXT,
        summary TEXT,

        tags_json TEXT,
        dept TEXT,
        card_style TEXT,
        
        status TEXT NOT NULL,
        published_at TEXT,

        author TEXT,
        ai_author TEXT,

        source_locale TEXT,
        translation_status TEXT NOT NULL,
        translation_provider TEXT,
        translation_version INTEGER NOT NULL,
        source_updated_at TEXT,
        translation_meta_json TEXT,

        content_html TEXT,

        current_revision_id TEXT,
        published_revision_id TEXT,

        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      INSERT INTO lab_notes_new (
        id, group_id, slug, locale,
        type, title,
        category, excerpt, department_id,
        shadow_density, safer_landing, read_time_minutes,
        coherence_score, subtitle, summary,
        tags_json, dept, card_style,
        status, published_at,
        author, ai_author,
        source_locale, translation_status, translation_provider,
        translation_version, source_updated_at, translation_meta_json,
        content_html,
        current_revision_id, published_revision_id,
        created_at, updated_at
      )
      SELECT
        id, group_id, slug, locale,
        type, title,
        category, excerpt, department_id,
        shadow_density, safer_landing, read_time_minutes,
        coherence_score, subtitle, summary,
        tags_json, dept, card_style,
        status, published_at,
        author, ai_author,
        source_locale, translation_status, translation_provider,
        translation_version, source_updated_at, translation_meta_json,
        content_html,
        current_revision_id, published_revision_id,
        created_at, updated_at
      FROM lab_notes;

      DROP TABLE lab_notes;
      ALTER TABLE lab_notes_new RENAME TO lab_notes;

      COMMIT;

      PRAGMA foreign_keys = ON;
    `);
    }

    // ---- v8: add real defaults + enforce unique (slug, locale) ----
    if (prevVersion < 8) {
        db.exec(`
    PRAGMA foreign_keys = OFF;
    BEGIN;

    DROP VIEW IF EXISTS v_lab_notes;
    DROP VIEW IF EXISTS v_lab_notes_current;

    -- 1) DEDUPE by (slug, locale), keep most recently updated
    DELETE FROM lab_notes
    WHERE id IN (
      SELECT id FROM (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY slug, locale
            ORDER BY updated_at DESC, created_at DESC
          ) AS rn
        FROM lab_notes
      )
      WHERE rn > 1
    );

    -- 2) Rebuild lab_notes with DEFAULTs
    DROP TABLE IF EXISTS lab_notes_new;

    CREATE TABLE lab_notes_new (
      id TEXT PRIMARY KEY,

      group_id TEXT NOT NULL DEFAULT 'core',
      slug TEXT NOT NULL,
      locale TEXT NOT NULL DEFAULT 'en',

      type TEXT NOT NULL DEFAULT 'labnote',
      title TEXT NOT NULL DEFAULT '',

      category TEXT,
      excerpt TEXT,
      department_id TEXT DEFAULT 'SCMS',
      shadow_density REAL DEFAULT 0,
      safer_landing INTEGER DEFAULT 0,
      read_time_minutes INTEGER DEFAULT 5,

      coherence_score REAL DEFAULT 1.0,
      subtitle TEXT,
      summary TEXT,

      tags_json TEXT,
      dept TEXT,
      card_style TEXT,

      status TEXT NOT NULL DEFAULT 'draft',
      published_at TEXT,

      author TEXT,
      ai_author TEXT,

      source_locale TEXT,
      translation_status TEXT NOT NULL DEFAULT 'original',
      translation_provider TEXT,
      translation_version INTEGER NOT NULL DEFAULT 1,
      source_updated_at TEXT,
      translation_meta_json TEXT,

      content_html TEXT,

      current_revision_id TEXT,
      published_revision_id TEXT,

      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    INSERT INTO lab_notes_new (
      id, group_id, slug, locale,
      type, title,
      category, excerpt, department_id,
      shadow_density, safer_landing, read_time_minutes,
      coherence_score, subtitle, summary,
      tags_json, dept, card_style,
      status, published_at,
      author, ai_author,
      source_locale, translation_status, translation_provider,
      translation_version, source_updated_at, translation_meta_json,
      content_html,
      current_revision_id, published_revision_id,
      created_at, updated_at
    )
    SELECT
      id,
      COALESCE(NULLIF(group_id,''), id, 'core'),
      slug,
      LOWER(COALESCE(NULLIF(locale,''), 'en')),

      COALESCE(NULLIF(type,''), 'labnote'),
      COALESCE(NULLIF(title,''), ''),

      category,
      excerpt,
      COALESCE(NULLIF(department_id,''), 'SCMS'),
      COALESCE(shadow_density, 0),
      COALESCE(safer_landing, 0),
      COALESCE(read_time_minutes, 5),

      COALESCE(coherence_score, 1.0),
      subtitle,
      summary,

      tags_json,
      dept,
      card_style,
      
      COALESCE(NULLIF(status,''), CASE WHEN published_at IS NOT NULL THEN 'published' ELSE 'draft' END),
      published_at,

      author,
      ai_author,

      source_locale,
      COALESCE(NULLIF(translation_status,''), 'original'),
      translation_provider,
      COALESCE(translation_version, 1),
      source_updated_at,
      translation_meta_json,

      content_html,

      current_revision_id,
      published_revision_id,

      COALESCE(NULLIF(created_at,''), strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      COALESCE(NULLIF(updated_at,''), COALESCE(NULLIF(created_at,''), strftime('%Y-%m-%dT%H:%M:%fZ','now')))
    FROM lab_notes;

    DROP TABLE lab_notes;
    ALTER TABLE lab_notes_new RENAME TO lab_notes;

    -- 3) Now enforce uniqueness correctly for localized slugs
    CREATE UNIQUE INDEX IF NOT EXISTS uq_lab_notes_slug_locale ON lab_notes(slug, locale);

    COMMIT;
    PRAGMA foreign_keys = ON;
  `);
    }

// ---- v10: remove legacy UNIQUE(slug) constraints (keep UNIQUE(slug, locale)) ----
    if (prevVersion < 10) {
        // Find any UNIQUE indexes that cover slug only (legacy) and drop them.
        // We keep uq_lab_notes_slug_locale (or recreate it if missing).
        const indexes = db
            .prepare(`PRAGMA index_list('lab_notes')`)
            .all() as Array<{ name: string; unique: number }>;

        for (const idx of indexes) {
            if (!idx.unique) continue;

            const cols = db
                .prepare(`PRAGMA index_info('${idx.name.replace(/'/g, "''")}')`)
                .all() as Array<{ name: string }>;

            const colNames = cols.map((c) => c.name);
            const isSlugOnly = colNames.length === 1 && colNames[0] === "slug";

            // Drop legacy slug-only uniqueness (this is what is causing your error)
            if (isSlugOnly) {
                db.exec(`DROP INDEX IF EXISTS ${idx.name};`);
                log?.(`[db] dropped legacy unique index on slug: ${idx.name}`);
            }
        }

        // Ensure the correct uniqueness exists
        db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_lab_notes_slug_locale
    ON lab_notes(slug, locale);
  `);
    }


    // ⚠️ WARNING ⚠️
    // If v_lab_notes ever reads lab_notes.content_html as the primary content source,
    // the system will desync (admin writes one model, readers consume another).
    // Always join through lab_note_revisions.


    // ✅ Views created LAST (after any rebuild)
    // IMPORTANT:
    // These views MUST be ledger-first.
    // lab_notes.content_html is legacy-only and must never be treated as truth.
    db.exec(`
          DROP VIEW IF EXISTS v_lab_notes;
          DROP VIEW IF EXISTS v_lab_notes_current;
        
          -- Canonical effective view
          -- Used by admin lists, detail views, and public reads (with filtering).
          CREATE VIEW v_lab_notes AS
          SELECT
            n.id,
            n.group_id,
            n.slug,
            n.locale,
            n.type,
            n.title,
        
            n.category,
            n.excerpt,
            n.department_id,
            n.shadow_density,
            n.safer_landing,
            n.read_time_minutes,
            n.coherence_score,
            n.subtitle,
            n.summary,
            n.tags_json,
            n.dept,
            n.card_style,
            
            n.status,
            n.published_at,
            n.author,
            n.ai_author,
        
            n.source_locale,
            n.translation_status,
            n.translation_provider,
            n.translation_version,
            n.source_updated_at,
            n.translation_meta_json,
        
            -- Ledger-first content resolution:
            -- 1) Published revision if published
            -- 2) Current draft revision
            -- 3) Any available revision
            -- 4) Legacy content_html (last-resort fallback)
            COALESCE(
              CASE
                WHEN n.status = 'published' THEN pub.content_markdown
                ELSE cur.content_markdown
              END,
              cur.content_markdown,
              pub.content_markdown,
              n.content_html
            ) AS content_markdown,
        
            -- Legacy passthrough (do not rely on this)
            n.content_html,
        
            n.current_revision_id,
            n.published_revision_id,
        
            n.created_at,
            n.updated_at
        
          FROM lab_notes n
          LEFT JOIN lab_note_revisions cur
            ON cur.id = n.current_revision_id
          LEFT JOIN lab_note_revisions pub
            ON pub.id = n.published_revision_id
          ;
        
          -- Admin-only "current draft truth" view
          CREATE VIEW v_lab_notes_current AS
          SELECT
            n.id AS note_id,
            n.slug,
            n.locale,
            n.title,
            n.status,
            n.published_at,
            n.author,
            n.ai_author,
            n.card_style,
        
            n.current_revision_id,
            n.published_revision_id,
        
            r.revision_num,
            r.schema_version,
            r.source,
            r.intent,
            r.intent_version,
            r.scope_json,
            r.side_effects_json,
            r.reversible,
            r.auth_type,
            r.scopes_json,
            r.frontmatter_json,
            r.content_markdown,
            r.content_hash,
            r.created_at AS revision_created_at,
        
            n.created_at,
            n.updated_at
        
          FROM lab_notes n
          LEFT JOIN lab_note_revisions r
            ON r.id = n.current_revision_id
          ;
`);


    // Set DB version last (after successful schema + data migration)
    setLabNotesSchemaVersion(db, LAB_NOTES_SCHEMA_VERSION);
    db.pragma("foreign_keys = ON");
    const result: MigrationResult = {
        addedColumns,
        createdFreshTable: !hadLabNotesTable,
        ranV2DataMigration,
    };

    if (
        log &&
        (result.createdFreshTable ||
            result.addedColumns.length > 0 ||
            prevVersion !== LAB_NOTES_SCHEMA_VERSION ||
            ranV2DataMigration)
    ) {
        const colsPart =
            result.addedColumns.length > 0
                ? `added ${result.addedColumns.length} column(s): ${result.addedColumns.join(", ")}`
                : "no column changes";

        const migPart = ranV2DataMigration ? "ran v2 revision seeding" : "no v2 data migration";

        log(
            `[db] lab_notes migration: v${prevVersion} → v${LAB_NOTES_SCHEMA_VERSION}; ${colsPart}; ${migPart}`
        );
    }

    return result;
}

function safeParseJsonArray(input: any): string[] {
    if (!input || typeof input !== "string") return [];
    try {
        const v = JSON.parse(input);
        if (Array.isArray(v)) return v.filter((x) => typeof x === "string");
        return [];
    } catch {
        return [];
    }
}
