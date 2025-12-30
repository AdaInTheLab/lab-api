import Database from "better-sqlite3";
import path from "path";

export type ApiLabNote = {
    id: string;
    slug: string;

    title: string;
    subtitle?: string;
    summary?: string;

    content_ref?: string;

    published: string; // "" or YYYY-MM-DD
    status: "draft" | "published" | "archived";
    type: "labnote" | "paper" | "memo";
    locale: string;

    department_id: string;
    dept?: string;

    shadow_density: number;
    safer_landing: boolean;

    tags: string[];
    readingTime: number;

    author?: { kind: "human" | "ai" | "hybrid"; name?: string; id?: string };

    created_at: string;
    updated_at: string;

    // optional if your API includes it:
    contentHtml?: string;
};

function safeJsonArray(input: any): string[] {
    if (!input || typeof input !== "string") return [];
    try {
        const v = JSON.parse(input);
        return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
    } catch {
        return [];
    }
}

function openDb() {
    const NODE_ENV = (process.env.NODE_ENV ?? "development").toLowerCase();
    const PROJECT_ROOT = process.cwd();
    const defaultDbFile = NODE_ENV === "production" ? "lab.db" : "lab.dev.db";
    const dbPath = process.env.DB_PATH
        ? path.resolve(process.env.DB_PATH)
        : path.resolve(PROJECT_ROOT, "data", defaultDbFile);

    return new Database(dbPath);
}

function mapRowToApiNote(r: any): ApiLabNote {
    return {
        id: r.id,
        slug: r.slug,

        title: r.title,
        subtitle: r.subtitle ?? undefined,
        summary: r.summary ?? r.excerpt ?? "",

        published: r.published_at ?? "",
        status: (r.status ?? "draft") as ApiLabNote["status"],
        type: (r.type ?? "labnote") as ApiLabNote["type"],
        locale: (r.locale ?? "en").toLowerCase(),

        department_id: r.department_id ?? "SCMS",
        dept: r.dept ?? undefined,

        shadow_density: Number(r.shadow_density ?? 0),
        safer_landing: !!r.safer_landing,

        tags: safeJsonArray(r.tags_json),
        readingTime: Number(r.read_time_minutes ?? 5),

        // if you’ve stored author_kind/author_name/author_id in the view:
        author: r.author_kind
            ? {
                kind: r.author_kind,
                ...(r.author_name ? { name: r.author_name } : {}),
                ...(r.author_id ? { id: r.author_id } : {}),
            }
            : undefined,

        created_at: r.created_at ?? "",
        updated_at: r.updated_at ?? "",
    };
}

/**
 * Returns notes for a locale.
 * If locale is omitted or "all", returns all locales (useful for admin/registry).
 */
export async function getAllLabNotes(locale?: string): Promise<ApiLabNote[]> {
    const db = openDb();
    try {
        const want = (locale ?? "en").toLowerCase();
        const rows =
            want === "all"
                ? (db
                    .prepare(
                        `SELECT * FROM v_lab_notes
               WHERE status != 'archived'
               ORDER BY COALESCE(updated_at, created_at) DESC`
                    )
                    .all() as any[])
                : (db
                    .prepare(
                        `SELECT * FROM v_lab_notes
               WHERE locale = ?
                 AND status != 'archived'
               ORDER BY COALESCE(updated_at, created_at) DESC`
                    )
                    .all(want) as any[]);

        return rows.map(mapRowToApiNote);
    } finally {
        db.close();
    }
}

export async function getLabNoteBySlug(
    slug: string,
    locale: string
): Promise<ApiLabNote | null> {
    const db = openDb();
    try {
        const want = (locale ?? "en").toLowerCase();

        const row =
            db
                .prepare(
                    `SELECT * FROM v_lab_notes
           WHERE slug = ?
             AND locale = ?
           LIMIT 1`
                )
                .get(slug, want) ?? null;

        return row ? mapRowToApiNote(row) : null;
    } finally {
        db.close();
    }
}
