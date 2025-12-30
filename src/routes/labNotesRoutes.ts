// src/routes/labNotesRoutes.ts
import type { Request, Response } from "express";
import type Database from "better-sqlite3";
import type { LabNoteRecord, TagResult } from "../types/labNotes.js";
import type { UpsertBody } from "../types/UpsertBody.js"
import { mapToLabNotePreview, mapToLabNoteView } from "../mappers/labNotesMapper.js";

// OPTIONAL: markdown -> html (pick one implementation)
// If you already have a markdown renderer elsewhere in the API, use that instead.
import { marked } from "marked"; // npm i marked

export function registerLabNotesRoutes(app: any, db: Database.Database) {
    // Public: Lab Notes list (preview)
    app.get("/lab-notes", (req: Request, res: Response) => {
        try {
            const locale = String(req.query.locale ?? "en").toLowerCase();

            const sqlAll = `
      SELECT
        id, slug, locale, type, status, title, subtitle, summary, excerpt, content_html,
        department_id, dept, shadow_density, safer_landing, read_time_minutes,
        published_at, created_at, updated_at
      FROM v_lab_notes
      WHERE status != 'archived'
      ORDER BY published_at DESC
    `;

            const sqlByLocale = `
      SELECT
        id, slug, locale, type, status, title, subtitle, summary, excerpt, content_html,
        department_id, dept, shadow_density, safer_landing, read_time_minutes,
        published_at, created_at, updated_at
      FROM v_lab_notes
      WHERE locale = ?
        AND status != 'archived'
      ORDER BY published_at DESC
    `;

            const notes = (locale === "all"
                    ? db.prepare(sqlAll).all()
                    : db.prepare(sqlByLocale).all(locale)
            ) as LabNoteRecord[];

            const mapped = notes.map((note) => {
                const tagRows = db
                    .prepare("SELECT tag FROM lab_note_tags WHERE note_id = ?")
                    .all(note.id) as TagResult[];

                return mapToLabNotePreview(note, tagRows.map((t) => t.tag));
            });

            return res.json(mapped);
        } catch (e: any) {
            console.error("GET /lab-notes failed:", e?.message);
            if (res.headersSent) return;
            return res.status(500).json({ error: e?.message ?? "unknown" });
        }
    });



    // Public: single Lab Note (detail)
    app.get("/lab-notes/:slug", (req: Request, res: Response) => {
        const { slug } = req.params;

        const note = db.prepare(`
          SELECT
            id, slug, title, excerpt, content_html, 
            department_id, shadow_density, coherence_score,
            safer_landing, read_time_minutes, published_at, category, created_at, updated_at
          FROM v_lab_notes
          WHERE slug = ?
        `).get(slug) as LabNoteRecord | undefined;


        if (!note) return res.status(404).json({ error: "Not found" });

        const tagRows = db
            .prepare("SELECT tag FROM lab_note_tags WHERE note_id = ?")
            .all(note.id) as TagResult[];

        res.json(mapToLabNoteView(note, tagRows.map((t) => t.tag)));
    });

    // Authenticated: upsert a note by slug
    app.post("/lab-notes/upsert", (req: Request, res: Response) => {
        // TODO: add auth middleware (Bearer token) when ready
        const body = req.body as Partial<UpsertBody>;

        if (!body.slug || !body.title || !body.markdown) {
            return res.status(400).json({ error: "slug, title, markdown are required" });
        }

        const slug = body.slug.trim();
        const title = body.title.trim();
        const markdown = body.markdown;
        const html = marked.parse(markdown) as string;

        const tags = body.tags ?? [];
        const department_id = body.department_id ?? "SCMS"; // choose your default
        const shadow_density = body.shadow_density ?? 0;
        const safer_landing = body.safer_landing ? 1 : 0;
        const read_time_minutes = body.read_time_minutes ?? null;
        const published_at = body.published_at ?? null;
        const category = body.category ?? (body as any).type ?? null; // map your frontmatter 'type' if you want
        const excerpt =
            body.excerpt ??
            markdown
                .replace(/```[\s\S]*?```/g, "")
                .replace(/[#>*_`]/g, "")
                .trim()
                .slice(0, 220);

        // Check for existing note
        const existing = db
            .prepare("SELECT id FROM lab_notes WHERE slug = ?")
            .get(slug) as { id: string } | undefined;

        const now = new Date().toISOString();
        const noteId = existing?.id ?? crypto.randomUUID();

        // Transaction: upsert note + tags
        const tx = db.transaction(() => {
            if (existing) {
                db.prepare(`
          UPDATE lab_notes
          SET
            title = ?,
            excerpt = ?,
            content_html = ?,
            department_id = ?,
            shadow_density = ?,
            safer_landing = ?,
            read_time_minutes = ?,
            published_at = COALESCE(?, published_at),
            category = ?,
            updated_at = ?
          WHERE slug = ?
        `).run(
                    title,
                    excerpt,
                    markdown,
                    html,
                    department_id,
                    shadow_density,
                    safer_landing,
                    read_time_minutes,
                    published_at,
                    category,
                    now,
                    slug
                );

                db.prepare("DELETE FROM lab_note_tags WHERE note_id = ?").run(noteId);
            } else {
                db.prepare(`
          INSERT INTO lab_notes (
            id, slug, title, excerpt, content_html,
            department_id, shadow_density, safer_landing,
            read_time_minutes, published_at, category,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
                    noteId,
                    slug,
                    title,
                    excerpt,
                    markdown,
                    html,
                    department_id,
                    shadow_density,
                    safer_landing,
                    read_time_minutes,
                    published_at,
                    category,
                    now,
                    now
                );
            }

            const insertTag = db.prepare(
                "INSERT INTO lab_note_tags (note_id, tag) VALUES (?, ?)"
            );
            for (const t of tags) {
                const tag = String(t).trim();
                if (tag) insertTag.run(noteId, tag);
            }
        });

        try {
            tx();
            return res.json({ ok: true, slug, action: existing ? "updated" : "created" });
        } catch (e: any) {
            return res.status(500).json({ ok: false, error: e?.message ?? "upsert failed" });
        }
    });

}
