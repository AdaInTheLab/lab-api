// src/services/syncLabNotesFromFs.ts
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import matter from "gray-matter";
import type Database from "better-sqlite3";

type SyncCounts = {
    rootDir: string;
    locales: string[];
    scanned: number;
    upserted: number;
    skipped: number;
    revisionsInserted: number;
    pointersUpdated: number;
    emptyBodySkipped: number;
    errors: Array<{ file: string; error: string }>;
};

/* ===========================================================
   🧷 Markdown → Ledger Sync (Guarded)
   -----------------------------------------------------------
   Goals:
   - MD is source of truth
   - Revisions are append-only truth in DB
   - Never create empty revisions
   - Never advance pointers to empty revisions
   - Never "unpublish" by clearing published_at unless explicit
   =========================================================== */

function sha256Hex(input: string): string {
    return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

function listMarkdownFilesRecursive(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...listMarkdownFilesRecursive(full));
        else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) out.push(full);
    }
    return out;
}

function slugFromFilename(filePath: string): string {
    return path.basename(filePath, path.extname(filePath));
}

function nowIso(): string {
    return new Date().toISOString();
}

export function syncLabNotesFromFs(db: Database.Database): SyncCounts {
    //TODO: TEMP
    console.log("[SYNC] LABNOTES_DIR =", process.env.LABNOTES_DIR);

    const rootDir = String(process.env.LABNOTES_DIR || "").trim();
    if (!rootDir) throw new Error("LABNOTES_DIR is not set");
    if (!fs.existsSync(rootDir)) throw new Error(`LABNOTES_DIR not found: ${rootDir}`);

    const localeDirs = fs
        .readdirSync(rootDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

    const locales = localeDirs.length ? localeDirs : ["en"];

    const counts: SyncCounts = {
        rootDir,
        locales,
        scanned: 0,
        upserted: 0,
        skipped: 0,
        revisionsInserted: 0,
        pointersUpdated: 0,
        emptyBodySkipped: 0,
        errors: [],
    };

    // -----------------------------
    // SQL: identity + metadata upsert
    // - Does NOT clear published_at unless excluded.published_at is provided
    // - Does NOT touch status (human-controlled)
    // -----------------------------
    const upsertNote = db.prepare(`
    INSERT INTO lab_notes (
      id, group_id, slug, locale,
      type, title,
      category, excerpt, department_id,
      shadow_density, coherence_score, safer_landing, read_time_minutes,
      published_at,
      created_at, updated_at
    )
    VALUES (
      COALESCE(?, lower(hex(randomblob(16)))),
      COALESCE(NULLIF(?, ''), 'core'),
      ?, LOWER(COALESCE(NULLIF(?, ''), 'en')),
      COALESCE(NULLIF(?, ''), 'labnote'),
      COALESCE(NULLIF(?, ''), ''),
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, 
      COALESCE(NULLIF(?, ''), strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      strftime('%Y-%m-%dT%H:%M:%fZ','now')
    )
    ON CONFLICT(slug, locale) DO UPDATE SET
      -- metadata is safe to update
      type=excluded.type,
      title=excluded.title,
      category=excluded.category,
      excerpt=excluded.excerpt,
      department_id=excluded.department_id,
      shadow_density=excluded.shadow_density,
      coherence_score=excluded.coherence_score,
      safer_landing=excluded.safer_landing,
      read_time_minutes=excluded.read_time_minutes,

      -- ✅ PRESERVE publish timestamp unless MD explicitly provides one
      published_at = CASE
        WHEN excluded.published_at IS NOT NULL THEN excluded.published_at
        ELSE lab_notes.published_at
      END,

      updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
  `);

    const selectNote = db.prepare(`
    SELECT id, status, published_at, current_revision_id, published_revision_id
    FROM lab_notes
    WHERE slug = ? AND locale = ?
    LIMIT 1
  `);

    const selectLatestRevision = db.prepare(`
    SELECT id, revision_num, content_hash, length(content_markdown) AS md_len
    FROM lab_note_revisions
    WHERE note_id = ?
    ORDER BY revision_num DESC
    LIMIT 1
  `);

    const insertRevision = db.prepare(`
    INSERT INTO lab_note_revisions (
      id, note_id,
      revision_num, supersedes_revision_id,
      frontmatter_json, content_markdown, content_hash,
      schema_version, source,
      intent, intent_version,
      scope_json, side_effects_json, reversible,
      auth_type, scopes_json,
      reasoning_json,
      created_at
    )
    VALUES (
      ?, ?,
      ?, ?,
      ?, ?, ?,
      ?, 'import',
      ?, '1',
      '[]', '[]', 1,
      'human_session', '[]',
      NULL,
      ?
    )
  `);

    const updatePointers = db.prepare(`
    UPDATE lab_notes
    SET
      current_revision_id = ?,
      published_revision_id = CASE
        WHEN status = 'published' THEN ?
        ELSE published_revision_id
      END,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id = ?
  `);

    const processFile = (filePath: string, locale: string) => {
        counts.scanned += 1;

        try {
            const raw = fs.readFileSync(filePath, "utf8");
            const parsed = matter(raw);

            const slug = String(parsed.data.slug || slugFromFilename(filePath)).trim();
            const title = String(parsed.data.title || slug).trim();

            const excerpt = parsed.data.excerpt ? String(parsed.data.excerpt).trim() : null;
            const category = parsed.data.category ? String(parsed.data.category) : null;
            const departmentId = parsed.data.department_id ? String(parsed.data.department_id) : null;

            const type = parsed.data.type ? String(parsed.data.type) : "labnote";

            const shadowDensity = parsed.data.shadow_density ?? null;
            const coherenceScore = parsed.data.coherence_score ?? null;
            const saferLanding = parsed.data.safer_landing ?? null;
            const readTimeMinutes = parsed.data.read_time_minutes ?? null;

            // ✅ Only set published_at if MD explicitly includes it
            const publishedAt = parsed.data.published_at ? String(parsed.data.published_at) : null;

            // --- Ledger body (source of truth) ---
            const markdown = String(parsed.content || "").trim();

            // 1) Ensure note registry row exists / metadata updated
            upsertNote.run(
                null, // id optional
                parsed.data.group_id ? String(parsed.data.group_id) : "core",
                slug,
                locale,
                type,
                title,
                category,
                excerpt,
                departmentId,
                shadowDensity,
                coherenceScore,
                saferLanding,
                readTimeMinutes,
                publishedAt,
                nowIso()
            );
            counts.upserted += 1;

            const noteRow = selectNote.get(slug, locale) as
                | {
                id: string;
                status: string | null;
                published_at: string | null;
                current_revision_id: string | null;
                published_revision_id: string | null;
            }
                | undefined;

            if (!noteRow) {
                counts.errors.push({ file: filePath, error: `note upsert failed for ${slug}:${locale}` });
                return;
            }

            // 2) GUARD: Never create / advance to an empty-body revision
            if (!markdown) {
                counts.emptyBodySkipped += 1;
                // No revision insert. No pointer changes. Metadata-only sync is allowed.
                return;
            }

            const hash = sha256Hex(markdown);

            const latest = selectLatestRevision.get(noteRow.id) as
                | { id: string; revision_num: number; content_hash: string; md_len: number }
                | undefined;

            // 3) Idempotency: if the latest revision already matches this body, do nothing
            if (latest && latest.content_hash === hash && (latest.md_len ?? 0) > 0) {
                counts.skipped += 1;
                return;
            }

            // 4) Insert new revision
            const newRevId = crypto.randomUUID();
            const nextNum = latest ? Number(latest.revision_num) + 1 : 1;
            const supersedes = latest ? latest.id : null;

            insertRevision.run(
                newRevId,
                noteRow.id,
                nextNum,
                supersedes,
                JSON.stringify(parsed.data ?? {}),
                markdown,
                hash,
                "v1",
                `sync:md:${slug}:${locale}`,
                nowIso()
            );
            counts.revisionsInserted += 1;

            // 5) Advance pointers ONLY to a non-empty revision (this one is guaranteed non-empty)
            updatePointers.run(newRevId, newRevId, noteRow.id);
            counts.pointersUpdated += 1;
        } catch (e: any) {
            counts.errors.push({ file: filePath, error: e?.message ?? String(e) });
        }
    };

    // Walk locales
    if (localeDirs.length) {
        for (const loc of localeDirs) {
            const files = listMarkdownFilesRecursive(path.join(rootDir, loc));
            for (const f of files) processFile(f, loc);
        }
    } else {
        const files = listMarkdownFilesRecursive(rootDir);
        for (const f of files) processFile(f, "en");
    }

    return counts;
}
