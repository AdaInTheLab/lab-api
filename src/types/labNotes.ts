// src/types/labNotes.ts

export type LabNoteType = "labnote" | "paper" | "memo" | "lore" | "weather";
export type LabNoteStatus = "published" | "draft" | "archived";

export const ALLOWED_NOTE_TYPES: ReadonlySet<LabNoteType> = new Set([
    "labnote",
    "paper",
    "memo",
    "lore",
    "weather",
]);

export interface LabNoteRecord {
    id: string;
    title: string;
    slug: string;

    category?: string;
    excerpt?: string;

    department_id?: string;
    shadow_density?: number;
    coherence_score?: number;
    safer_landing?: number;

    read_time_minutes?: number;
    published_at?: string;

    content_html?: string | null;

    created_at?: string;
    updated_at?: string;

    subtitle?: string | null;

    type?: LabNoteType | null;
    status?: LabNoteStatus | null;

    dept?: string | null;
    locale?: string | null;

    author_kind?: "human" | "ai" | "hybrid" | null;
    author_name?: string | null;
    author_id?: string | null;
}

export interface TagResult {
    tag: string;
}

export interface LabNoteView {
    id: string;
    slug: string;

    title: string;
    subtitle?: string;
    summary?: string;

    contentHtml: string;
    published: string;

    status?: LabNoteStatus;
    type?: LabNoteType;
    dept?: string;
    locale?: string;

    author?: {
        kind: "human" | "ai" | "hybrid";
        name?: string;
        id?: string;
    };

    department_id: string;
    shadow_density: number;
    safer_landing: boolean;
    tags: string[];
    readingTime: number;

    created_at?: string;
    updated_at?: string;
}
