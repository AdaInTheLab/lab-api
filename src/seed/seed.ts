/* ===========================================================
   🌱 HUMAN PATTERN LAB — MARKER NOTE SEED (IDEMPOTENT)
   -----------------------------------------------------------
   Purpose:
     Ensure the "api-marker-note" exists and has valid pointers.
     This function may run on every boot and MUST be safe.

   Rules:
     1) If marker note already has current_revision_id -> do nothing.
     2) If revisions exist but pointers are missing -> repair pointers.
     3) If no revisions exist -> create a new revision with next revision_num.
   =========================================================== */

import crypto from "crypto";
import type Database from "better-sqlite3";

type SeedMarkerArgs = {
    db: Database.Database;

    // Optional overrides if you want to customize identity
    noteId?: string;
    slug?: string;
    locale?: string;

    // Optional logging hook
    log?: (msg: string) => void;
};

function nowIso(): string {
    return new Date().toISOString();
}

export function seedMarkerNote({
                                   db,
                                   noteId = "c45362a2-5d3d-413d-bf5e-d910d842d359",
                                   slug = "api-marker-note",
                                   locale = "en",
                                   log,
                               }: SeedMarkerArgs) {
    const ts = nowIso();

    // ---------------------------------------------------------------------------
    // 0) Ensure the metadata row exists (idempotent)
    // ---------------------------------------------------------------------------
    // We keep this minimal: only fields needed to identify + not break views.
    // Note: pointers are handled below.
    const upsertNote = db.prepare(`
    INSERT INTO lab_notes (
      id, group_id, slug, locale,
      type, title,
      status, published_at,
      created_at, updated_at
    )
    VALUES (
      @id, @group_id, @slug, @locale,
      @type, @title,
      @status, @published_at,
      @created_at, @updated_at
    )
    ON CONFLICT(id) DO UPDATE SET
      group_id=excluded.group_id,
      slug=excluded.slug,
      locale=excluded.locale,
      type=excluded.type,
      title=excluded.title,
      status=excluded.status,
      published_at=excluded.published_at,
      updated_at=excluded.updated_at
  `);

    upsertNote.run({
        id: noteId,
        group_id: noteId, // stable group
        slug,
        locale,
        type: "memo",
        title: "API Marker Note",
        status: "draft",
        published_at: null,
        created_at: ts,
        updated_at: ts,
    });

    // ---------------------------------------------------------------------------
    // 1) If pointers already exist, bail (this is the #1 safety valve)
    // ---------------------------------------------------------------------------
    const existingPointers = db.prepare(`
    SELECT
      current_revision_id AS cur,
      published_revision_id AS pub
    FROM lab_notes
    WHERE id = ?
    LIMIT 1
  `).get(noteId) as { cur?: string | null; pub?: string | null } | undefined;

    if (existingPointers?.cur) {
        log?.(`[seedMarkerNote] ok: current_revision_id already set (${existingPointers.cur})`);
        return { status: "noop" as const, noteId, currentRevisionId: existingPointers.cur };
    }

    // ---------------------------------------------------------------------------
    // 2) If any revisions already exist, REPAIR pointers instead of inserting
    // ---------------------------------------------------------------------------
    const latestRevision = db.prepare(`
    SELECT id, revision_num
    FROM lab_note_revisions
    WHERE note_id = ?
    ORDER BY revision_num DESC
    LIMIT 1
  `).get(noteId) as { id: string; revision_num: number } | undefined;

    if (latestRevision?.id) {
        const repair = db.prepare(`
      UPDATE lab_notes
      SET
        current_revision_id = @rev,
        published_revision_id = COALESCE(published_revision_id, @rev),
        updated_at = @now
      WHERE id = @id
    `);

        repair.run({ id: noteId, rev: latestRevision.id, now: ts });

        log?.(
            `[seedMarkerNote] repaired pointers: current_revision_id=${latestRevision.id} (rev ${latestRevision.revision_num})`
        );

        return {
            status: "repaired" as const,
            noteId,
            currentRevisionId: latestRevision.id,
            revisionNum: latestRevision.revision_num,
        };
    }

    // ---------------------------------------------------------------------------
    // 3) Truly new: insert first revision safely (revision_num derived, not assumed)
    // ---------------------------------------------------------------------------
    const revisionId = crypto.randomUUID();

    // Minimal, valid revision payload
    const frontmatter = JSON.stringify({
        id: noteId,
        slug,
        locale,
        title: "API Marker Note",
        type: "memo",
        status: "draft",
    });

    const contentMarkdown =
        `# API Marker Note\n\n` +
        `This note exists to confirm the Lab Notes ledger + render pipeline is alive.\n\n` +
        `- Created: ${ts}\n` +
        `- Source: seedMarkerNote\n`;

    // If we got here, we know there are no revisions, so next revision_num is 1.
    const revisionNum = 1;

    const insertRevision = db.prepare(`
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
      @id, @note_id, @revision_num, NULL,
      @frontmatter_json, @content_markdown, @content_hash,
      @schema_version, @source,
      @intent, @intent_version,
      @scope_json, @side_effects_json, @reversible,
      @auth_type, @scopes_json,
      NULL,
      @created_at
    )
  `);

    // Cheap stable hash (enough for integrity checks)
    const contentHash = crypto
        .createHash("sha256")
        .update(frontmatter + "\n---\n" + contentMarkdown, "utf8")
        .digest("hex");

    insertRevision.run({
        id: revisionId,
        note_id: noteId,
        revision_num: revisionNum,
        frontmatter_json: frontmatter,
        content_markdown: contentMarkdown,
        content_hash: contentHash,
        schema_version: "0.1",
        source: "import",
        intent: "seed_marker_note",
        intent_version: "1",
        scope_json: JSON.stringify(["bootstrap"]),
        side_effects_json: JSON.stringify(["create"]),
        reversible: 1,
        auth_type: "system",          // ✅ allowed by schema? if not, set to 'human_session'
        scopes_json: JSON.stringify([]),
        created_at: ts,
    });

    // ---------------------------------------------------------------------------
    // 4) Set pointers (now that revision exists)
    // ---------------------------------------------------------------------------
    const setPointers = db.prepare(`
    UPDATE lab_notes
    SET
      current_revision_id = @rev,
      published_revision_id = COALESCE(published_revision_id, @rev),
      updated_at = @now
    WHERE id = @id
  `);

    setPointers.run({ id: noteId, rev: revisionId, now: ts });

    log?.(`[seedMarkerNote] seeded fresh marker note revision=${revisionId}`);

    return { status: "seeded" as const, noteId, currentRevisionId: revisionId, revisionNum };
}
