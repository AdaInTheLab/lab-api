import {LabNoteRecord, LabNoteView} from "../types/labNotes.js";

function deriveStatus(published: string): "published" | "draft" {
    return published ? "published" : "draft";
}

function normalizeStatus(s?: "published" | "draft" | "archived" | null | undefined, published?: string): "published" | "draft" | "archived" {
    const v = (s ?? "").toLowerCase();
    if (v === "published" || v === "draft" || v === "archived") return v;
    return deriveStatus(published ?? "");
}
type LabNoteType = "labnote" | "paper" | "memo" | "lore" | "weather";
const ALLOWED_NOTE_TYPES: ReadonlySet<LabNoteType> = new Set([
    "labnote",
    "paper",
    "memo",
    "lore",
    "weather",
]);

function deriveType(note: LabNoteRecord): LabNoteType {
    // Prefer stored note.type if present
    const raw = (note.type ?? "").toLowerCase() as LabNoteType;

    if (raw && ALLOWED_NOTE_TYPES.has(raw)) return raw;

    // Optional: derive from category if it has meaning
    if (note.category === "paper") return "paper";
    if (note.category === "memo") return "memo";
    if (note.category === "lore") return "lore";
    if (note.category === "weather") return "weather";

    return "labnote";
}
export function mapToLabNoteView(note: LabNoteRecord, tags: string[]): {
    id: string;
    slug: string;
    title: string;
    subtitle: string | undefined;
    summary: string;
    contentHtml: string;
    published: string;
    status: "published" | "draft" | "archived";
    type: "labnote" | "paper" | "memo" | "lore" | "weather";
    dept: string | undefined;
    locale: string;
    author: { kind: "human" | "ai" | "hybrid" } | undefined;
    department_id: string;
    shadow_density: number;
    safer_landing: boolean;
    tags: string[];
    readingTime: number;
    created_at: string | undefined;
    updated_at: string | undefined
} {
    const published = note.published_at ?? "";

    return {
        id: note.id,
        slug: note.slug,
        title: note.title,

        subtitle: note.subtitle ?? undefined,
        summary: note.excerpt ?? "",

        contentHtml: note.content_html?.trim() || "<p>Content pending migration.</p>",
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

export function mapToLabNotePreview(note: LabNoteRecord, tags: string[]): {
    id: string;
    slug: string;
    title: string;
    subtitle: string | undefined;
    summary: string;
    contentHtml: string;
    published: string;
    status: "published" | "draft" | "archived";
    type: "labnote" | "paper" | "memo" | "lore" | "weather";
    dept: string | undefined;
    locale: string;
    author: { kind: "human" | "ai" | "hybrid" } | undefined;
    department_id: string;
    shadow_density: number;
    safer_landing: boolean;
    tags: string[];
    readingTime: number;
    created_at: string | undefined;
    updated_at: string | undefined
} {
    const published = note.published_at ?? "";

    return {
        id: note.id,
        slug: note.slug,
        title: note.title,

        subtitle: note.subtitle ?? undefined,
        summary: note.excerpt ?? "",

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


