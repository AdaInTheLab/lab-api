// src/types/labNotes.ts

export interface LabNoteRecord {
    id: string;
    title: string;
    slug: string;

    category?: string;          // reserved; not yet part of public contract
    excerpt?: string;

    department_id?: string;
    shadow_density?: number;
    coherence_score?: number;
    safer_landing?: number;     // 0/1 in sqlite

    read_time_minutes?: number;
    published_at?: string;

    // content
    content_html?: string | null;
    content_md?: string | null;

    // timestamps
    created_at?: string;
    updated_at?: string;

    // 🆕 optional future fields (safe to add now)
    subtitle?: string | null;

    type?: "labnote" | "paper" | "memo" | null;
    status?: "published" | "draft" | "archived" | null;

    dept?: string | null;       // human readable label if you store it
    locale?: string | null;

    author_kind?: "human" | "ai" | "hybrid" | null;
    author_name?: string | null;
    author_id?: string | null;
}


export interface TagResult {
    tag: string;
}

// What the frontend expects (your canonical UI contract)
export interface LabNoteView {
    id: string;
    slug: string;

    title: string;
    subtitle?: string;
    summary?: string;

    contentHtml: string;
    published: string;

    // 🆕 (recommended)
    status?: "published" | "draft" | "archived";
    type?: "labnote" | "paper" | "memo";
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

    // optional but nice if you want them later
    created_at?: string;
    updated_at?: string;
}

