// src/mappers/labNotesMapper.ts
import { marked } from "marked";
import type { LabNoteRecord } from "../types/labNotes.js";

/* ===========================================================
   🧭 Lab Notes Mapper — Ledger-First Output
   -----------------------------------------------------------
   Responsibilities:
   - Normalize DB/view records into stable API shapes
   - Resolve content using ledger-first fields (content_markdown)
   - Preserve legacy fallbacks (content_html) without relying on them

   Non-responsibilities:
   - Persisting notes
   - Syncing markdown
   - Auth decisions
   =========================================================== */

type LabNoteStatus = "published" | "draft" | "archived";
type LabNoteType = "labnote" | "paper" | "memo" | "lore" | "weather";

const ALLOWED_NOTE_TYPES: ReadonlySet<LabNoteType> = new Set([
    "labnote",
    "paper",
    "memo",
    "lore",
    "weather",
]);

marked.setOptions({
    gfm: true,
    breaks: false, // ✅ strict
});

/**
 * deriveStatus
 * If status is missing/invalid, infer from publish timestamp.
 */
function deriveStatus(published: string): "published" | "draft" {
    return published ? "published" : "draft";
}

/**
 * normalizeStatus
 * DB may contain null/invalid values in early migrations; normalize safely.
 */
function normalizeStatus(
    s?: LabNoteStatus | null | undefined,
    published?: string
): LabNoteStatus {
    const v = String(s ?? "").toLowerCase();
    if (v === "published" || v === "draft" || v === "archived") return v;
    return deriveStatus(published ?? "");
}

/**
 * deriveType
 * Prefer stored note.type; fall back to category-derived type if meaningful.
 */
function deriveType(note: LabNoteRecord): LabNoteType {
    const raw = String(note.type ?? "").toLowerCase() as LabNoteType;
    if (raw && ALLOWED_NOTE_TYPES.has(raw)) return raw;

    if (note.category === "paper") return "paper";
    if (note.category === "memo") return "memo";
    if (note.category === "lore") return "lore";
    if (note.category === "weather") return "weather";

    return "labnote";
}

/**
 * resolveContentHtml
 * Ledger-first content resolution:
 * - Prefer v_lab_notes.content_markdown (already ledger-resolved)
 * - Fallback to legacy lab_notes.content_html
 * - Final fallback: migration placeholder
 */
function resolveContentHtml(note: LabNoteRecord): string {
    // Ledger-first: markdown from v_lab_notes
    const markdown = note.content_markdown?.trim();

    if (markdown) {
        return marked.parse(markdown) as string;
    }

    // Legacy fallback (v1 carryover)
    const legacyHtml = note.content_html?.trim();
    if (legacyHtml) {
        return legacyHtml;
    }

    // Final safety net
    return "<p>Content pending migration.</p>";
}

/**
 * mapToLabNoteView
 * Full note view (detail endpoint output).
 */
export function mapToLabNoteView(note: LabNoteRecord, tags: string[]) {
    const published = note.published_at ?? "";

    return {
        id: note.id,
        slug: note.slug,
        title: note.title,

        subtitle: note.subtitle ?? undefined,
        summary: note.excerpt ?? "",

        // ✅ Ledger-first content resolution
        contentHtml: resolveContentHtml(note),

        // ✅ Always present (empty string means “not published”)
        published,

        status: normalizeStatus(note.status, published),
        type: deriveType(note),

        dept: note.dept ?? undefined,
        locale: note.locale ?? "en",

        author: note.author_kind
            ? {
                kind: note.author_kind,
                ...(note.author_name ? { name: note.author_name } : {}),
                ...(note.author_id ? { id: note.author_id } : {}),
            }
            : undefined,

        department_id: note.department_id ?? "SCMS",
        shadow_density: note.shadow_density ?? 0,
        safer_landing: Boolean(note.safer_landing),

        tags,
        readingTime: note.read_time_minutes ?? 5,

        created_at: note.created_at,
        updated_at: note.updated_at,
    };
}

/**
 * mapToLabNotePreview
 * Preview shape for list/cards. Intentionally omits contentHtml.
 */
export function mapToLabNotePreview(note: LabNoteRecord, tags: string[]) {
    const published = note.published_at ?? "";

    return {
        id: note.id,
        slug: note.slug,
        title: note.title,

        subtitle: note.subtitle ?? undefined,
        summary: note.excerpt ?? "",

        // Previews never ship full content payload
        contentHtml: "",

        published,

        status: normalizeStatus(note.status, published),
        type: deriveType(note),

        dept: note.dept ?? undefined,
        locale: note.locale ?? "en",

        author: note.author_kind
            ? {
                kind: note.author_kind,
                ...(note.author_name ? { name: note.author_name } : {}),
                ...(note.author_id ? { id: note.author_id } : {}),
            }
            : undefined,

        department_id: note.department_id ?? "SCMS",
        shadow_density: note.shadow_density ?? 0,
        safer_landing: Boolean(note.safer_landing),

        tags,
        readingTime: note.read_time_minutes ?? 5,

        created_at: note.created_at,
        updated_at: note.updated_at,
    };
}
