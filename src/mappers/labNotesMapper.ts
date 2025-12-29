import {LabNoteRecord, LabNoteView} from "../types/labNotes.js";

function deriveStatus(published: string): "published" | "draft" {
    return published ? "published" : "draft";
}

function deriveType(note: LabNoteRecord): "labnote" | "paper" | "memo" {
    // If you already store note.type, prefer it:
    if (note.type) return note.type;

    // Optional: derive from category if it has meaning
    if (note.category === "paper") return "paper";
    if (note.category === "memo") return "memo";

    return "labnote";
}

export function mapToLabNoteView(note: LabNoteRecord, tags: string[]): LabNoteView {
    const published = note.published_at ?? "";
    const status: "published" | "draft" = published ? "published" : "draft";

    return {
        id: note.id,
        slug: note.slug,
        title: note.title,

        subtitle: note.subtitle ?? undefined,
        summary: note.excerpt ?? "",

        contentHtml: note.content_html?.trim() || "<p>Content pending migration.</p>",
        published,

        status,
        type: note.type ?? "labnote",   // ✅ canonical
        // category intentionally NOT exposed

        dept: note.dept ?? undefined,
        locale: note.locale ?? "en",

        department_id: note.department_id ?? "SCMS",
        shadow_density: note.shadow_density ?? 0,
        safer_landing: Boolean(note.safer_landing),

        tags,
        readingTime: note.read_time_minutes ?? 5,
    };
}


export function mapToLabNotePreview(note: LabNoteRecord, tags: string[]): LabNoteView {
    const published = note.published_at ?? "";
    const status = (note.status ?? deriveStatus(published));

    return {
        id: note.id,
        slug: note.slug,
        title: note.title,

        subtitle: note.subtitle ?? undefined,
        summary: note.excerpt ?? "",

        contentHtml: "",
        published,

        status,
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

