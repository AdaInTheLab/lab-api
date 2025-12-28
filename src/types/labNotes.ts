// src/types/labNotes.ts

export interface LabNoteRecord {
    id: string;
    title: string;
    slug: string;
    category?: string;
    excerpt?: string;
    department_id?: string;
    shadow_density?: number;
    coherence_score?: number;
    safer_landing?: number; // stored as 0/1 in sqlite
    read_time_minutes?: number;
    published_at?: string;
    content_html?: string | null;
    content_md?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface TagResult {
    tag: string;
}

// What the frontend expects (your canonical UI contract)
export interface LabNoteView {
    id: string;     // uuid/internal
    slug: string;   // public URL identity

    title: string;
    subtitle?: string;
    summary?: string;
    contentHtml: string;
    published: string;
    department_id: string;
    shadow_density: number;
    safer_landing: boolean;
    tags: string[];
    readingTime: number;
}
