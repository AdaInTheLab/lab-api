/* ===========================================================
   🌱 HUMAN PATTERN LAB — DB SEED SCRIPT (FILE-SOURCE MODE)
   -----------------------------------------------------------
   Purpose: Seed DB from canonical markdown files in:
            src/labnotes/<locale>/*.md
            - lab_notes: metadata + pointers
            - lab_note_revisions: append-only markdown truth
            - lab_note_tags: normalized tags
   Safety:  - Refuses to run in NODE_ENV=test
            - Refuses to run in production unless explicitly allowed
   =========================================================== */
// scripts/seed.ts
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { migrateLabNotesSchema } from "../db/migrateLabNotes.js"; // adjust path to your project
import MarkdownIt from "markdown-it";

// ── ENV NORMALIZATION ──────────────────────────────────────
const rawEnv = process.env.NODE_ENV ?? "development";
const NODE_ENV =
    rawEnv === "dev"
        ? "development"
        : rawEnv === "prod"
            ? "production"
            : rawEnv;

if (!["development", "test", "production"].includes(NODE_ENV)) {
    throw new Error(`Invalid NODE_ENV: ${NODE_ENV}`);
}

// ── PATH RESOLUTION (MATCHES API DEFAULTS) ─────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// project root (src/seed → src → project root)
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

const DATA_DIR = path.join(PROJECT_ROOT, "data");

const defaultDbFile = NODE_ENV === "production" ? "lab.db" : "lab.dev.db";

const dbPath =
    NODE_ENV === "test"
        ? ":memory:"
        : process.env.DB_PATH
            ? path.resolve(process.env.DB_PATH)
            : path.join(DATA_DIR, defaultDbFile);

// ── GUARDRAILS ─────────────────────────────────────────────
if (NODE_ENV === "test") {
    throw new Error("❌ Refusing to seed in NODE_ENV=test.");
}

if (NODE_ENV !== "test") {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (NODE_ENV === "production" && process.env.ALLOW_PROD_SEED !== "1") {
    throw new Error(
        "❌ Refusing to seed in NODE_ENV=production. Set ALLOW_PROD_SEED=1 if intentional."
    );
}

if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

console.log(`🌱 Seeding DB at: ${dbPath}`);
console.log(`🧭 NODE_ENV=${NODE_ENV}`);

const db = new Database(dbPath);

// Ensure schema exists / upgraded
migrateLabNotesSchema(db);

// ── HELPERS ────────────────────────────────────────────────
const md = new MarkdownIt({
    html: false, // 🔒 blocks raw HTML entirely
    linkify: true,
    typographer: true,
});

function nowIso() {
    return new Date().toISOString();
}

function sha256Hex(input: string): string {
    return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

function asString(v: any, fallback = ""): string {
    return typeof v === "string" ? v : fallback;
}

function asNumber(v: any, fallback = 0): number {
    if (typeof v === "number") return v;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function asBool(v: any, fallback = false): boolean {
    if (typeof v === "boolean") return v;
    if (typeof v === "string") {
        if (v.toLowerCase() === "true") return true;
        if (v.toLowerCase() === "false") return false;
    }
    return fallback;
}

function asStringArray(v: any): string[] {
    if (Array.isArray(v)) return v.filter((x) => typeof x === "string");
    return [];
}

function listLocales(): string[] {
    if (!fs.existsSync(LABNOTES_ROOT)) return [];
    return fs
        .readdirSync(LABNOTES_ROOT, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .filter((name) => /^[a-z]{2}(-[a-z]{2})?$/i.test(name)); // en, ko, en-us, etc.
}

/**
 * Very small frontmatter parser:
 * - expects a file starting with:
 *   ---\n
 *   key: value\n
 *   ...\n
 *   ---\n
 * - returns { frontmatter, body }
 */
function parseFrontmatter(mdText: string): { frontmatter: Record<string, any>; body: string } {
    const trimmed = mdText.trimStart();
    if (!trimmed.startsWith("---")) {
        return { frontmatter: {}, body: mdText };
    }

    const lines = trimmed.split("\n");
    if (lines.length < 3) return { frontmatter: {}, body: mdText };

    // Find second '---'
    let endIdx = -1;
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === "---") {
            endIdx = i;
            break;
        }
    }
    if (endIdx === -1) return { frontmatter: {}, body: mdText };

    const fmLines = lines.slice(1, endIdx);
    const body = lines.slice(endIdx + 1).join("\n").replace(/^\n+/, "");

    const fm: Record<string, any> = {};
    for (const rawLine of fmLines) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;

        const colon = line.indexOf(":");
        if (colon === -1) continue;

        const key = line.slice(0, colon).trim();
        let val = line.slice(colon + 1).trim();

        // Remove trailing comments (simple)
        const hash = val.indexOf(" #");
        if (hash !== -1) val = val.slice(0, hash).trim();

        // Try parse array like [a, b] or ["a","b"]
        if (val.startsWith("[") && val.endsWith("]")) {
            const inner = val.slice(1, -1).trim();
            if (!inner) {
                fm[key] = [];
                continue;
            }

            // Try JSON first if it looks like it
            try {
                const maybeJson = val.replace(/'/g, '"');
                const parsed = JSON.parse(maybeJson);
                if (Array.isArray(parsed)) {
                    fm[key] = parsed.map(String);
                    continue;
                }
            } catch {
                // fall through
            }

            // Fallback: split by comma
            const parts = inner
                .split(",")
                .map((p) => p.trim())
                .filter(Boolean);
            fm[key] = parts.map((p) => p.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1"));
            continue;
        }

        // Booleans
        if (val === "true" || val === "false") {
            fm[key] = val === "true";
            continue;
        }

        // Numbers
        if (/^-?\d+(\.\d+)?$/.test(val)) {
            fm[key] = Number(val);
            continue;
        }

        // Quoted string
        fm[key] = val.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }

    return { frontmatter: fm, body };
}

// ── LAB NOTES SOURCE (FRONTEND REPO) ────────────────────────
const FRONTEND_REPO_DEFAULT = path.resolve(process.cwd(), "..", "the-human-pattern-lab");

// where markdown actually lives in the frontend
const LABNOTES_ROOT = process.env.LABNOTES_ROOT
    ? path.resolve(process.env.LABNOTES_ROOT)
    : path.join(FRONTEND_REPO_DEFAULT, "src", "labnotes");

// ── PREPARE DB OBJECTS ─────────────────────────────────────
// Ensure the tag table exists for dev seed safety
db.exec(`
    CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

    CREATE TABLE IF NOT EXISTS lab_note_tags (
                                                 note_id TEXT NOT NULL,
                                                 tag TEXT NOT NULL,
                                                 UNIQUE(note_id, tag)
    );
    CREATE INDEX IF NOT EXISTS idx_lab_note_tags_note_id ON lab_note_tags(note_id);
    CREATE INDEX IF NOT EXISTS idx_lab_note_tags_tag ON lab_note_tags(tag);
`);

// ── SQL STATEMENTS ─────────────────────────────────────────

// 🔎 Prefer identity by (slug, locale). If it exists, reuse id.
// This prevents “slug edits” from forking new note identities.
const findNoteBySlugLocale = db.prepare(`
    SELECT id
    FROM lab_notes
    WHERE slug = ? AND locale = ?
    LIMIT 1
`);

// Upsert by (slug, locale). Keeps pointers intact (we do NOT overwrite them here).
const upsertNoteBySlugLocale = db.prepare(`
    INSERT INTO lab_notes (
        id, group_id, slug, locale,
        type, title,
        category, excerpt, department_id,
        shadow_density, safer_landing, read_time_minutes,
        coherence_score, subtitle, summary,
        tags_json, dept,
        status, published_at,
        author, ai_author,
        source_locale, translation_status, translation_provider,
        translation_version, source_updated_at, translation_meta_json,
        content_html,
        created_at, updated_at
    )
    VALUES (
               @id, @group_id, @slug, @locale,
               @type, @title,
               @category, @excerpt, @department_id,
               @shadow_density, @safer_landing, @read_time_minutes,
               @coherence_score, @subtitle, @summary,
               @tags_json, @dept,
               @status, @published_at,
               @author, @ai_author,
               @source_locale, @translation_status, @translation_provider,
               @translation_version, @source_updated_at, @translation_meta_json,
               @content_html,
               @created_at, @updated_at
           )
    ON CONFLICT(slug, locale) DO UPDATE SET
                                            group_id=excluded.group_id,
                                            type=excluded.type,
                                            title=excluded.title,
                                            category=excluded.category,
                                            excerpt=excluded.excerpt,
                                            department_id=excluded.department_id,
                                            shadow_density=excluded.shadow_density,
                                            safer_landing=excluded.safer_landing,
                                            read_time_minutes=excluded.read_time_minutes,
                                            coherence_score=excluded.coherence_score,
                                            subtitle=excluded.subtitle,
                                            summary=excluded.summary,
                                            tags_json=excluded.tags_json,
                                            dept=excluded.dept,

                                            -- ⚠️ Status/published_at are file-driven here. If you want “admin is source of truth”
                                            -- for status, change these two lines to preserve existing values instead.
                                            status=excluded.status,
                                            published_at=excluded.published_at,

                                            author=excluded.author,
                                            ai_author=excluded.ai_author,
                                            content_html=excluded.content_html,
                                            updated_at=excluded.updated_at
`);

const getPointer = db.prepare(`
    SELECT current_revision_id AS cur
    FROM lab_notes
    WHERE id = ?
`);

const getLatestRevision = db.prepare(`
    SELECT id, revision_num, content_hash, length(content_markdown) AS md_len
    FROM lab_note_revisions
    WHERE note_id = ?
    ORDER BY revision_num DESC
    LIMIT 1
`);

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
               @id, @note_id, @revision_num, @supersedes_revision_id,
               @frontmatter_json, @content_markdown, @content_hash,
               @schema_version, @source,
               @intent, @intent_version,
               @scope_json, @side_effects_json, @reversible,
               @auth_type, @scopes_json,
               NULL,
               @created_at
           )
`);

const setPointers = db.prepare(`
    UPDATE lab_notes
    SET current_revision_id = @rev,
        published_revision_id = COALESCE(published_revision_id, @rev),
        updated_at = @now
    WHERE id = @id
`);

const insertTag = db.prepare(`
    INSERT OR IGNORE INTO lab_note_tags (note_id, tag)
    VALUES (?, ?)
`);

// ── SEED FROM FILES ────────────────────────────────────────
function listMarkdownFiles(locale: string): string[] {
    const dir = path.join(LABNOTES_ROOT, locale);
    if (!fs.existsSync(dir)) return [];

    return fs
        .readdirSync(dir)
        .filter((f) => f.toLowerCase().endsWith(".md"))
        .map((f) => path.join(dir, f));
}

function readAndNormalize(filePath: string, locale: string): {
    noteId: string;
    groupId: string;
    slug: string;
    type: string;
    title: string;
    category: string | null;
    excerpt: string | null;
    department_id: string | null;
    dept: string | null;
    shadow_density: number;
    safer_landing: boolean;
    read_time_minutes: number;
    published_at: string | null;
    status: string;
    contentHtml: string;
    tags: string[];
    summary: string | null;
    subtitle: string | null;
    author: string | null;
    ai_author: string | null;
    markdown: string;
    frontmatterJson: string;
    contentHash: string;
} {
    const raw = fs.readFileSync(filePath, "utf8");
    const { frontmatter, body } = parseFrontmatter(raw);

    // Slug: prefer frontmatter.slug, else filename
    const filenameSlug = path.basename(filePath).replace(/\.md$/i, "");
    const slug = asString(frontmatter.slug, filenameSlug);

    // group_id: keep translations together; default to stable baseId
    const baseId = asString(frontmatter.id, slug); // stable across translations
    const groupId = asString(frontmatter.group_id, baseId);

    // ✅ unique row per locale
    const noteId = `${groupId}:${locale}`;

    const type = asString(frontmatter.type, "labnote");
    const title = asString(frontmatter.title, slug);

    const dept = frontmatter.dept ? asString(frontmatter.dept) : null;
    const department_id =
        frontmatter.department_id
            ? asString(frontmatter.department_id)
            : dept
                ? dept
                : null;

    const tags = asStringArray(frontmatter.tags);
    const status = asString(frontmatter.status, frontmatter.published ? "published" : "draft");
    const published_at = frontmatter.published ? asString(frontmatter.published) : null;

    const shadow_density = asNumber(frontmatter.shadow_density, 4);
    const safer_landing = asBool(frontmatter.safer_landing, true);

    const read_time_minutes = asNumber(
        frontmatter.readingTime,
        asNumber(frontmatter.read_time_minutes, 5)
    );

    const excerpt = frontmatter.excerpt ? asString(frontmatter.excerpt) : null;
    const summary = frontmatter.summary ? asString(frontmatter.summary) : null;
    const subtitle = frontmatter.subtitle ? asString(frontmatter.subtitle) : null;
    const category = frontmatter.category ? asString(frontmatter.category) : null;

    const author = frontmatter.author ? asString(frontmatter.author) : null;
    const ai_author = frontmatter.ai_author
        ? asString(frontmatter.ai_author)
        : frontmatter.aiAuthor
            ? asString(frontmatter.aiAuthor)
            : null;

    // Ledger truth: markdown body only (frontmatter snapshot stored separately)
    const markdown = body;

    const fmSnapshot = {
        ...frontmatter,
        id: noteId,
        slug,
        locale,
        type,
        title,
        dept: dept ?? undefined,
        department_id: department_id ?? undefined,
        tags,
        status,
        published: published_at ?? undefined,
    };

    const frontmatterJson = JSON.stringify(fmSnapshot);
    const canonical = `${frontmatterJson}\n---\n${body}`;
    const contentHash = sha256Hex(canonical);

    const contentHtml = md.render(body);

    return {
        noteId,
        groupId,
        slug,
        type,
        title,
        category,
        excerpt,
        department_id,
        dept,
        shadow_density,
        safer_landing,
        read_time_minutes,
        published_at,
        status,
        tags,
        summary,
        subtitle,
        author,
        ai_author,
        contentHtml,
        markdown,
        frontmatterJson,
        contentHash,
    };
}

// ── COLLECT FILES ──────────────────────────────────────────
const locales = listLocales();
const files: Array<{ locale: string; filePath: string }> = [];

for (const locale of locales) {
    for (const filePath of listMarkdownFiles(locale)) {
        files.push({ locale, filePath });
    }
}

if (files.length === 0) {
    console.log("⚠️ No markdown files found under src/labnotes/<locale>/*.md — nothing to seed.");
    process.exit(0);
}

// ── TRANSACTION ────────────────────────────────────────────
const tx = db.transaction(() => {
    let seeded = 0;
    let skipped = 0;
    let pointerRepaired = 0;
    let emptyBodySkipped = 0;

    for (const f of files) {
        const ts = nowIso();
        const normalized = readAndNormalize(f.filePath, f.locale);

        // ------------------------------------------------------------
        // Identity resolution: reuse existing row for (slug, locale)
        // Prevents “slug changes” from forking identities.
        // ------------------------------------------------------------
        const existing = findNoteBySlugLocale.get(normalized.slug, f.locale) as { id: string } | undefined;

        const effectiveNoteId = existing?.id ?? normalized.noteId;

        // ------------------------------------------------------------
        // Upsert note metadata by (slug, locale) — pointers preserved
        // ------------------------------------------------------------
        upsertNoteBySlugLocale.run({
            id: effectiveNoteId,
            group_id: normalized.groupId,
            slug: normalized.slug,
            locale: f.locale,

            type: normalized.type,
            title: normalized.title,

            category: normalized.category,
            excerpt: normalized.excerpt,
            department_id: normalized.department_id,
            shadow_density: normalized.shadow_density,
            safer_landing: normalized.safer_landing ? 1 : 0,
            read_time_minutes: normalized.read_time_minutes,

            coherence_score: 1.0,
            subtitle: normalized.subtitle,
            summary: normalized.summary,

            tags_json: JSON.stringify(normalized.tags),
            dept: normalized.dept,

            status: normalized.status,
            published_at: normalized.published_at,

            author: normalized.author,
            ai_author: normalized.ai_author,

            source_locale: null,
            translation_status: "original",
            translation_provider: null,
            translation_version: 1,
            source_updated_at: null,
            translation_meta_json: null,

            content_html: normalized.contentHtml,

            created_at: ts,
            updated_at: ts,
        });

        // Tags table (optional but nice)
        for (const tag of normalized.tags) insertTag.run(effectiveNoteId, tag);

        // ------------------------------------------------------------
        // Ledger seed guardrails:
        // - Never create empty revisions
        // - Never duplicate (note_id, revision_num)
        // - Repair pointers if revisions exist but current_revision_id missing
        // ------------------------------------------------------------
        const mdBody = normalized.markdown?.trim() ?? "";
        if (!mdBody) {
            emptyBodySkipped++;
            continue;
        }

        const latest = getLatestRevision.get(effectiveNoteId) as
            | { id: string; revision_num: number; content_hash: string; md_len: number }
            | undefined;

        // If any revision already exists, never try to reinsert revision_num=1.
        if (latest) {
            // If pointer missing but ledger exists, repair pointer to latest non-empty revision.
            const pointer = getPointer.get(effectiveNoteId) as { cur?: string } | undefined;
            if (!pointer?.cur && (latest.md_len ?? 0) > 0) {
                setPointers.run({ rev: latest.id, now: ts, id: effectiveNoteId });
                pointerRepaired++;
                continue;
            }

            // If latest revision matches this file’s canonical content, do nothing.
            if (latest.content_hash === normalized.contentHash && (latest.md_len ?? 0) > 0) {
                skipped++;
                continue;
            }

            // If you DO NOT want seed to append revisions on changes, flip this to:
            // skipped++; continue;
            const revisionId = crypto.randomUUID();
            const nextNum = Number(latest.revision_num) + 1;

            insertRevision.run({
                id: revisionId,
                note_id: effectiveNoteId,
                revision_num: nextNum,
                supersedes_revision_id: latest.id,
                frontmatter_json: normalized.frontmatterJson,
                content_markdown: mdBody,
                content_hash: normalized.contentHash,
                schema_version: "0.1",
                source: "import",
                intent: "seed_from_files",
                intent_version: "1",
                scope_json: JSON.stringify(["files"]),
                side_effects_json: JSON.stringify(["append_revision"]),
                reversible: 1,
                auth_type: "human_session",
                scopes_json: JSON.stringify([]),
                created_at: ts,
            });

            setPointers.run({ rev: revisionId, now: ts, id: effectiveNoteId });
            seeded++;
            continue;
        }

        // No revisions exist yet → create initial revision_num=1
        const revisionId = crypto.randomUUID();

        insertRevision.run({
            id: revisionId,
            note_id: effectiveNoteId,
            revision_num: 1,
            supersedes_revision_id: null,
            frontmatter_json: normalized.frontmatterJson,
            content_markdown: mdBody,
            content_hash: normalized.contentHash,
            schema_version: "0.1",
            source: "import",
            intent: "seed_from_files",
            intent_version: "1",
            scope_json: JSON.stringify(["files"]),
            side_effects_json: JSON.stringify(["create"]),
            reversible: 1,
            auth_type: "human_session",
            scopes_json: JSON.stringify([]),
            created_at: ts,
        });

        setPointers.run({ rev: revisionId, now: ts, id: effectiveNoteId });
        seeded++;
    }

    console.log(`✅ Seeded ${seeded} notes from files`);
    if (skipped > 0) console.log(`↩️ Skipped ${skipped} (no content change / already current)`);
    if (pointerRepaired > 0) console.log(`🧷 Repaired ${pointerRepaired} missing pointer(s)`);
    if (emptyBodySkipped > 0) console.log(`🕳️ Skipped ${emptyBodySkipped} (empty markdown body)`);
});

tx();
