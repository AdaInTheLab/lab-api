export type UpsertBody = {
    slug: string;
    title: string;
    excerpt?: string;
    markdown: string;          // raw md from skulk
    tags?: string[];
    department_id?: string;
    shadow_density?: number;
    safer_landing?: boolean;
    read_time_minutes?: number;
    published_at?: string;
    category?: string;
};