// src/db/migrateLabNotes.ts
import Database from "better-sqlite3";
import crypto from "crypto";

const LAB_NOTES_SCHEMA_VERSION = 2;

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
    ranV2DataMigration: boolean;
};

function sha256Hex(input: string): string {
    return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

function nowIso(): string {
    return new Date().toISOString();
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

        // Content (v1 storage)
        { name: "content_md", ddl: "TEXT NOT NULL DEFAULT ''" },
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
    UPDATE lab_notes SET content_md = '' WHERE content_md IS NULL;

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

    // Views
    db.exec(`
    DROP VIEW IF EXISTS v_lab_notes;

    -- Back-compat view that mirrors the existing wide lab_notes fields
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

      current_revision_id,
      published_revision_id,

      created_at,
      updated_at
    FROM lab_notes;

    DROP VIEW IF EXISTS v_lab_notes_current;

    -- v2 convenience view: current revision data (append-only truth)
    CREATE VIEW v_lab_notes_current AS
    SELECT
      n.id AS note_id,
      n.slug,
      n.locale,
      n.title,
      n.status,
      n.author,
      n.ai_author,
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
      ON r.id = n.current_revision_id;
  `);

    const prevVersion = getLabNotesSchemaVersion(db);

    let ranV2DataMigration = false;

    // ---- v2 data migration (one-time) ----
    // If coming from v1, create revision_num=1 for any note that lacks current_revision_id.
    if (prevVersion < 2) {
        const tx = db.transaction(() => {
            const rows = db.prepare(`
        SELECT
          id,
          slug,
          locale,
          type,
          title,
          subtitle,
          summary,
          tags_json,
          dept,
          status,
          published_at,
          author,
          ai_author,
          content_md,
          created_at,
          updated_at
        FROM lab_notes
      `).all() as any[];

            const insertRev = db.prepare(`
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
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?,
          ?, ?, ?,
          ?, ?,
          ?,
          ?
        )
      `);

            const updateNotePointers = db.prepare(`
        UPDATE lab_notes
        SET current_revision_id = ?,
            published_revision_id = COALESCE(published_revision_id, ?)
        WHERE id = ?
      `);

            const insertEvent = db.prepare(`
        INSERT INTO lab_events (
          id, event_type, note_id, revision_id,
          intent, intent_version,
          actor_type, actor_id,
          auth_type, scopes_json,
          payload_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

            for (const n of rows) {
                // Only seed a revision if we don't already have a pointer.
                const pointer = db
                    .prepare(`SELECT current_revision_id FROM lab_notes WHERE id = ?`)
                    .get(n.id) as { current_revision_id?: string } | undefined;

                if (pointer?.current_revision_id) continue;

                const revisionId = crypto.randomUUID();

                // Build minimal frontmatter snapshot from existing columns.
                // (We keep this conservative—frontmatter is "about the note", provenance lives in revision fields.)
                const frontmatter = {
                    id: n.slug || n.id,
                    type: n.type || "labnote",
                    title: n.title || n.slug || n.id,
                    subtitle: n.subtitle ?? undefined,
                    summary: n.summary ?? undefined,
                    tags: safeParseJsonArray(n.tags_json),
                    dept: n.dept ?? undefined,
                    status: n.status || "draft",
                    published: n.published_at ?? undefined,
                    author: n.author ?? undefined,
                    ai_author: n.ai_author ?? undefined,
                    locale: n.locale || "en",
                };

                const frontmatterJson = JSON.stringify(frontmatter);
                const contentMarkdown = n.content_md ?? "";
                const canonical = `${frontmatterJson}\n---\n${contentMarkdown}`;
                const contentHash = sha256Hex(canonical);

                // v2 contract/provenance defaults for legacy data import
                const schemaVersion = "0.1"; // adjust if you have a better canonical value
                const source = "import";
                const intent = "create_lab_note";
                const intentVersion = "1";
                const scopeJson = JSON.stringify(["db"]);
                const sideEffectsJson = JSON.stringify(["create"]);
                const reversible = 1;
                const authType = "human_session";
                const scopesJson = JSON.stringify([]);

                insertRev.run(
                    revisionId,
                    n.id,
                    1,
                    null,
                    frontmatterJson,
                    contentMarkdown,
                    contentHash,
                    schemaVersion,
                    source,
                    intent,
                    intentVersion,
                    scopeJson,
                    sideEffectsJson,
                    reversible,
                    authType,
                    scopesJson,
                    null,
                    n.updated_at || n.created_at || nowIso()
                );

                // If it was already "published", treat this seeded revision as published pointer too.
                const shouldPublishPointer =
                    (n.status === "published" || !!n.published_at) ? revisionId : null;

                updateNotePointers.run(revisionId, shouldPublishPointer, n.id);

                // Event trail
                insertEvent.run(
                    crypto.randomUUID(),
                    "revision_seeded",
                    n.id,
                    revisionId,
                    intent,
                    intentVersion,
                    "system",
                    "db_migrator",
                    authType,
                    scopesJson,
                    JSON.stringify({ fromVersion: prevVersion, toVersion: 2 }),
                    nowIso()
                );
            }
        });

        tx();
        ranV2DataMigration = true;
    }

    // Set DB version last (after successful schema + data migration)
    setLabNotesSchemaVersion(db, LAB_NOTES_SCHEMA_VERSION);

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

        log(`[db] lab_notes migration: v${prevVersion} → v${LAB_NOTES_SCHEMA_VERSION}; ${colsPart}; ${migPart}`);
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
