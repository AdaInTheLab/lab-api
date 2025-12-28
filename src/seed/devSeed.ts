// src/seed/devSeed.ts
import Database from "better-sqlite3";

type SeedNote = {
    id: string;
    title: string;
    slug: string;
    category: string;
    excerpt: string;
    department_id: string;
    shadow_density: number;
    safer_landing: boolean;
    read_time_minutes: number;
    published_at: string;
    coherence_score?: number;
    content_html?: string | null;
    content_md?: string | null;
    tags: string[];
};

const notes: SeedNote[] = [
    // paste your seed notes here (same as scripts/seed.ts)
];

export function seedDevDb(db: Database.Database) {
    const insertNote = db.prepare(`
    INSERT OR IGNORE INTO lab_notes (
      id, title, slug, category, excerpt,
      content_html, content_md,
      department_id, shadow_density, coherence_score,
      safer_landing, read_time_minutes,
      published_at, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

    const insertTag = db.prepare(`
    INSERT OR IGNORE INTO lab_note_tags (note_id, tag)
    VALUES (?, ?)
  `);

    const nowIso = () => new Date().toISOString();

    const tx = db.transaction(() => {
        for (const note of notes) {
            const ts = nowIso();
            insertNote.run(
                note.id,
                note.title,
                note.slug,
                note.category,
                note.excerpt,
                note.content_html ?? null,
                note.content_md ?? null,
                note.department_id,
                note.shadow_density,
                note.coherence_score ?? 1.0,
                note.safer_landing ? 1 : 0,
                note.read_time_minutes,
                note.published_at,
                ts,
                ts
            );

            for (const tag of note.tags) {
                insertTag.run(note.id, tag);
            }
        }
    });

    tx();
}
