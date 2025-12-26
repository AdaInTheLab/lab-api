import {LabNoteRecord, LabNoteView} from "../types/labNotes.js";

export function mapToLabNoteView(note: LabNoteRecord, tags: string[]): LabNoteView {
    return {
        id: note.id,          // ✅ uuid/internal id
        slug: note.slug,      // ✅ public url identity
        title: note.title,
        subtitle: undefined,
        summary: note.excerpt ?? "",
        contentHtml: note.content_html?.trim() || "<p>Content pending migration.</p>",
        published: note.published_at ?? "",
        department_id: note.department_id ?? "SCMS",
        shadow_density: note.shadow_density ?? 0,
        safer_landing: Boolean(note.safer_landing),
        tags,
        readingTime: note.read_time_minutes ?? 5,
    };
}

export function mapToLabNotePreview(note: LabNoteRecord, tags: string[]): LabNoteView {
    return {
        id: note.id,          // ✅ uuid
        slug: note.slug,      // ✅ slug
        title: note.title,
        subtitle: undefined,
        summary: note.excerpt ?? "",
        contentHtml: "",
        published: note.published_at ?? "",
        department_id: note.department_id ?? "SCMS",
        shadow_density: note.shadow_density ?? 0,
        safer_landing: Boolean(note.safer_landing),
        tags,
        readingTime: note.read_time_minutes ?? 5,
    };
}