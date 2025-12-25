// src/mappers/labNotesMapper.ts
import type { LabNoteRecord, LabNoteView } from "../types/labNotes.js";

export function mapToLabNoteView(note: LabNoteRecord, tags: string[]): LabNoteView {
    return {
        id: note.slug,
        title: note.title,
        subtitle: undefined,
        summary: note.excerpt ?? "", // ✅ still useful as fallback
        contentHtml:
            note.content_html?.trim() ||
            "<p>Content pending migration.</p>",
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
        id: note.slug,
        title: note.title,
        subtitle: undefined,                 // or map from a column if you add one later
        summary: note.excerpt ?? "",         // ✅ card hover uses this
        contentHtml: "",                     // ✅ keep list payload light
        published: note.published_at ?? "",
        department_id: note.department_id ?? "SCMS",
        shadow_density: note.shadow_density ?? 0,
        safer_landing: Boolean(note.safer_landing),
        tags,
        readingTime: note.read_time_minutes ?? 5,
    };
}