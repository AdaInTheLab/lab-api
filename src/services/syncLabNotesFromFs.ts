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

/**
 * Convert arbitrary JS values to types that better-sqlite3 can bind:
 * numbers | strings | bigints | buffers | null
 * - booleans become 0/1
 * - objects/arrays become JSON strings
 */
function bindable(v: any) {
    if (v === undefined || v === null) return null;
    if (typeof v === "boolean") return v ? 1 : 0;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    if (typeof v === "bigint") return v;
    if (typeof v === "string") return v;
    if (Buffer.isBuffer(v)) return v;
    if (v instanceof Date) return v.toISOString();
    return JSON.stringify(v);
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

function safeString(v: any): string | null {
    if (v === undefined || v === null) return null;
    return String(v);
}

function jsonString(v: any, fallback: any): string {
    // Always return a JSON string for json columns
    const val = v === undefined ? fallback : v;
    try {
        return JSON.stringify(val);
    } catch {
        return JSON.stringify(fallback);
    }
}

export function syncLabNotesFromFs(db: Database.Database): SyncCounts {
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
    // SQL: identity + metadata upsert (NAMED PARAMS)
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
      COALESCE(@id, lower(hex(randomblob(16)))),
      COALESCE(NULLIF(@group_id, ''), 'core'),
      @slug,
      LOWER(COALESCE(NULLIF(@locale, ''), 'en')),
      COALESCE(NULLIF(@type, ''), 'labnote'),
      COALESCE(NULLIF(@title, ''), ''),
      @category,
      @excerpt,
      @department_id,
      @shadow_density,
      @coherence_score,
      @safer_landing,
      @read_time_minutes,
      @published_at,
      COALESCE(NULLIF(@created_at, ''), strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      strftime('%Y-%m-%dT%H:%M:%fZ','now')
    )
    ON CONFLICT(slug, locale) DO UPDATE SET
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

    // -----------------------------
    // SQL: revisions insert (NAMED PARAMS)
    // We accept JSON fields as strings (already serialized)
    // -----------------------------
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
      @id, @note_id,
      @revision_num, @supersedes_revision_id,
      @frontmatter_json, @content_markdown, @content_hash,
      @schema_version, @source,
      @intent, @intent_version,
      @scope_json, @side_effects_json, @reversible,
      @auth_type, @scopes_json,
      @reasoning_json,
      @created_at
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
            const type = parsed.data.type ? String(parsed.data.type) : "labnote";

            // Frontmatter fields that land in lab_notes
            const shadowDensity = bindable(parsed.data.shadow_density);
            const coherenceScore = bindable(parsed.data.coherence_score);
            const saferLanding = bindable(parsed.data.safer_landing);
            const readTimeMinutes = bindable(parsed.data.read_time_minutes);

            // These might be strings (preferred), but bindable makes them safe anyway
            const excerpt = bindable(parsed.data.excerpt);
            const category = bindable(parsed.data.category);
            const departmentId = bindable(parsed.data.department_id);

            // ✅ Only set published_at if MD explicitly includes it
            const publishedAt = parsed.data.published_at ? String(parsed.data.published_at) : null;

            // --- Ledger body (source of truth) ---
            const markdown = String(parsed.content || "").trim();

            // 1) Ensure note registry row exists / metadata updated
            upsertNote.run({
                id: null,
                group_id: parsed.data.group_id ? String(parsed.data.group_id) : "core",
                slug,
                locale,
                type,
                title,
                category,
                excerpt,
                department_id: departmentId,
                shadow_density: shadowDensity,
                coherence_score: coherenceScore,
                safer_landing: saferLanding,
                read_time_minutes: readTimeMinutes,
                published_at: publishedAt,
                created_at: nowIso(),
            });
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

            // We store the full frontmatter as JSON for traceability
            const frontmatterJson = jsonString(parsed.data ?? {}, {});

            // intent: allow string, otherwise store json-stringified
            const intentVal =
                typeof parsed.data?.intent === "string"
                    ? parsed.data.intent
                    : parsed.data?.intent != null
                        ? JSON.stringify(parsed.data.intent)
                        : `sync:md:${slug}:${locale}`; // ✅ default, never null

            // Use common-ish frontmatter keys if present, default to []
            const scopeJson = jsonString(parsed.data?.scope, []);
            const sideEffectsJson = jsonString(parsed.data?.side_effects, []);
            const scopesJson = jsonString(parsed.data?.scopes, []);

            // reversible: boolean-ish -> 0/1
            const reversible = bindable(parsed.data?.reversible) ?? 1;

            // reasoning: allow string, otherwise JSON
            const reasoningJson =
                parsed.data?.reasoning == null
                    ? null
                    : typeof parsed.data.reasoning === "string"
                        ? JSON.stringify({ text: parsed.data.reasoning })
                        : JSON.stringify(parsed.data.reasoning);

            insertRevision.run({
                id: newRevId,
                note_id: noteRow.id,
                revision_num: nextNum,
                supersedes_revision_id: supersedes,
                frontmatter_json: frontmatterJson,
                content_markdown: markdown,
                content_hash: hash,
                schema_version: "v1",
                source: "import",
                intent: intentVal,
                intent_version: "1",
                scope_json: scopeJson,
                side_effects_json: sideEffectsJson,
                reversible: reversible,
                auth_type: "human_session",
                scopes_json: scopesJson,
                reasoning_json: reasoningJson,
                created_at: nowIso(),
            });
            counts.revisionsInserted += 1;

            // 5) Advance pointers ONLY to a non-empty revision (this one is guaranteed non-empty)
            updatePointers.run(newRevId, newRevId, noteRow.id);
            counts.pointersUpdated += 1;
        } catch (e: any) {
            counts.errors.push({ file: filePath, error: e?.message ?? String(e) });
        }
    };

    // Wrap in a transaction so you don't half-write if something explodes mid-sync
    const syncTx = db.transaction(() => {
        if (localeDirs.length) {
            for (const loc of localeDirs) {
                const files = listMarkdownFilesRecursive(path.join(rootDir, loc));
                for (const f of files) processFile(f, loc);
            }
        } else {
            const files = listMarkdownFilesRecursive(rootDir);
            for (const f of files) processFile(f, "en");
        }
    });

    syncTx();

    return counts;
}
