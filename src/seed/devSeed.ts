// src/seed/devSeed.ts
import Database from "better-sqlite3";

type SeedNote = {
    id: string;                // row id (uuid)
    group_id?: string;         // shared id for translated siblings (optional; will default to id)
    title: string;
    slug: string;

    locale?: string;           // default 'en'
    type?: "labnote" | "paper" | "memo";
    dept?: string;             // optional label (e.g. "SCMS")

    status?: "draft" | "published" | "archived";
    published_at?: string | null;

    author?: string | null;
    ai_author?: string | null;

    // ✅ Keep these
    category?: string | null;
    excerpt?: string | null;
    department_id?: string | null;
    shadow_density?: number | null;
    safer_landing?: boolean;
    read_time_minutes?: number | null;
    coherence_score?: number | null;

    // Translation metadata (optional)
    source_locale?: string | null;
    translation_status?: "original" | "machine" | "human" | "needs_review";
    translation_provider?: string | null;
    translation_version?: number;
    source_updated_at?: string | null;
    translation_meta_json?: string | null;

    subtitle?: string | null;
    summary?: string | null;

    // You can keep this if other parts of the app use it, but DB canonical is read_time_minutes
    reading_time?: number | null;

    tags?: string[];
    content_html?: string | null;

    // ✅ Canonical markdown field for DB
    content_md: string;
};

const notes: SeedNote[] = [
    // paste your seed notes here
];

export function seedDevDb(db: Database.Database) {
    const insertNote = db.prepare(`
        INSERT OR IGNORE INTO lab_notes (
            id,
            group_id,
            slug,
            locale,
            type,
            title,

            category,
            excerpt,
            department_id,
            shadow_density,
            safer_landing,
            read_time_minutes,
            coherence_score,

            subtitle,
            summary,
            tags_json,
            dept,
            status,
            published_at,
            author,
            ai_author,

            source_locale,
            translation_status,
            translation_provider,
            translation_version,
            source_updated_at,
            translation_meta_json,

            content_md,
            content_html,

            created_at,
            updated_at
        )
        VALUES (
                   ?, ?, ?, ?, ?, ?,
                   ?, ?, ?, ?, ?, ?, ?,
                   ?, ?, ?, ?, ?, ?, ?,
                   ?, ?, ?, ?, ?, ?,
                   ?, ?,
                   ?, ?
               )
    `);

    const nowIso = () => new Date().toISOString();

    const tx = db.transaction(() => {
        for (const note of notes) {
            const ts = nowIso();

            const locale = note.locale ?? "en";
            const type = note.type ?? "labnote";
            const dept = note.dept ?? "SCMS";
            const status = note.status ?? "draft";
            const groupId = note.group_id ?? note.id;

            const tagsJson = JSON.stringify(note.tags ?? []);

            const readTimeMinutes =
                note.read_time_minutes ??
                (note.reading_time != null ? Math.max(1, Math.round(note.reading_time)) : null);

            insertNote.run(
                note.id,
                groupId,
                note.slug,
                locale,
                type,
                note.title,

                note.category ?? null,
                note.excerpt ?? null,
                note.department_id ?? "SCMS",
                note.shadow_density ?? null,
                note.safer_landing ? 1 : 0,
                readTimeMinutes,
                note.coherence_score ?? 1.0,

                note.subtitle ?? null,
                note.summary ?? null,
                tagsJson,
                dept,
                status,
                note.published_at ?? null,
                note.author ?? "Ada",
                note.ai_author ?? "Lyric",

                note.source_locale ?? null,
                note.translation_status ?? "original",
                note.translation_provider ?? null,
                note.translation_version ?? 1,
                note.source_updated_at ?? null,
                note.translation_meta_json ?? null,

                note.content_md,
                note.content_html ?? null,

                ts,
                ts
            );
        }
    });

    tx();
}
