export type UpsertBody = {
    // identity
    slug: string;
    title: string;
    locale?: string;            // e.g. "en", "en-US", "ko"

    // content
    markdown: string;           // raw md input
    excerpt?: string;           // optional override
    summary?: string;           // longer abstract (UI-facing)

    // taxonomy
    type?: "labnote" | "paper" | "memo" | "lore";
    status?: "draft" | "published";
    category?: string;          // legacy / optional
    dept?: string;              // human-facing dept label

    // metadata
    tags?: string[];
    department_id?: string;
    shadow_density?: number;
    safer_landing?: boolean;
    read_time_minutes?: number;

    // publishing
    published_at?: string;      // YYYY-MM-DD (only meaningful if published)
};
