// src/routes/labNotesRoutes.ts
import type { Request, Response } from "express";
import type Database from "better-sqlite3";
import type { LabNoteRecord, TagResult } from "../types/labNotes.js";
import type { UpsertBody } from "../types/UpsertBody.js"
import { mapToLabNotePreview, mapToLabNoteView } from "../mappers/labNotesMapper.js";
import { normalizeLocale } from "../lib/helpers.js"

// OPTIONAL: markdown -> html (pick one implementation)
// If you already have a markdown renderer elsewhere in the API, use that instead.
import { marked } from "marked"; // npm i marked

export function registerLabNotesRoutes(app: any, db: Database.Database) {
    // Public: Lab Notes list (preview)
    app.get("/lab-notes", (req: Request, res: Response) => {
        try {
            const baseLocale = (input: unknown) => {
                const raw = String(input ?? "en").trim().toLowerCase();
                if (!raw) return "en";
                const two = raw.split(/[-_]/)[0];
                return two === "all" ? "all" : (two || "en");
            };

            const locale = normalizeLocale(req.query.locale);

            const orderBy = `
      ORDER BY
        CASE WHEN published_at IS NULL OR published_at = '' THEN 1 ELSE 0 END,
        published_at DESC,
        updated_at DESC
    `;

            const sqlAll = `
      SELECT
        id, slug, locale, type, status, title, subtitle, summary, excerpt, content_html,
        department_id, dept, shadow_density, safer_landing, read_time_minutes,
        published_at, created_at, updated_at
      FROM v_lab_notes
      WHERE status != 'archived'
      ${orderBy}
    `;

            const sqlByLocale = `
      SELECT
        id, slug, locale, type, status, title, subtitle, summary, excerpt, content_html,
        department_id, dept, shadow_density, safer_landing, read_time_minutes,
        published_at, created_at, updated_at
      FROM v_lab_notes
      WHERE locale = ?
        AND status != 'archived'
      ${orderBy}
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
        const markdown = String(body.markdown);
        const html = marked.parse(markdown) as string;

        // ✅ locale must match your schema + UI behavior
        const locale = normalizeLocale((body as any).locale);

        // tags + metadata
        const tags = body.tags ?? [];
        const department_id = body.department_id ?? "SCMS";
        const dept = (body as any).dept ?? null;

        const shadow_density = body.shadow_density ?? 0;
        const safer_landing = body.safer_landing ? 1 : 0;
        const read_time_minutes = body.read_time_minutes ?? 5;

        // type/status (support your taxonomy)
        const type = ((body as any).type ?? "labnote");
        const status =
            ((body as any).status ?? ((body.published_at ?? "").trim() ? "published" : "draft"));

        // published date only when published
        const published_at =
            status === "published"
                ? ((body.published_at ?? "").trim() || new Date().toISOString().slice(0, 10))
                : null;

        // summary/excerpt
        const summary = (body as any).summary ?? null;

        const excerpt =
            body.excerpt ??
            markdown
                .replace(/```[\s\S]*?```/g, "")
                .replace(/[#>*_`]/g, "")
                .trim()
                .slice(0, 220);

        // category: keep if you still use it, otherwise null
        const category = body.category ?? null;

        // ✅ check existing by (slug, locale)
        const existing = db
            .prepare("SELECT id FROM lab_notes WHERE slug = ? AND locale = ?")
            .get(slug, locale) as { id: string } | undefined;

        const noteId = existing?.id ?? crypto.randomUUID();

        const tx = db.transaction(() => {
            if (existing) {
                db.prepare(`
        UPDATE lab_notes
        SET
          title = ?,
          excerpt = ?,
          summary = ?,
          content_html = ?,
          department_id = ?,
          dept = ?,
          type = ?,
          status = ?,
          shadow_density = ?,
          safer_landing = ?,
          read_time_minutes = ?,
          published_at = ?,
          category = ?,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
        WHERE slug = ? AND locale = ?
      `).run(
                    title,
                    excerpt,
                    summary,
                    html,              // ✅ store HTML in content_html
                    department_id,
                    dept,
                    type,
                    status,
                    shadow_density,
                    safer_landing,
                    read_time_minutes,
                    published_at,
                    category,
                    slug,
                    locale
                );

                db.prepare("DELETE FROM lab_note_tags WHERE note_id = ?").run(noteId);
            } else {
                db.prepare(`
        INSERT INTO lab_notes (
          id, group_id, slug, locale,
          type, status, title,
          category, excerpt, summary, content_html,
          department_id, dept, shadow_density, safer_landing,
          read_time_minutes, published_at,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?,
          strftime('%Y-%m-%dT%H:%M:%fZ','now'),
          strftime('%Y-%m-%dT%H:%M:%fZ','now')
        )
      `).run(
                    noteId,
                    noteId,            // group_id defaulting to noteId keeps v2 happy
                    slug,
                    locale,
                    type,
                    status,
                    title,
                    category,
                    excerpt,
                    summary,
                    html,              // ✅ store HTML
                    department_id,
                    dept,
                    shadow_density,
                    safer_landing,
                    read_time_minutes,
                    published_at
                );
            }

            const insertTag = db.prepare(
                "INSERT OR IGNORE INTO lab_note_tags (note_id, tag) VALUES (?, ?)"
            );

            for (const t of tags) {
                const tag = String(t).trim();
                if (tag) insertTag.run(noteId, tag);
            }
        });

        try {
            tx();
            return res.json({
                ok: true,
                slug,
                locale,
                id: noteId,
                action: existing ? "updated" : "created",
            });
        } catch (e: any) {
            return res.status(500).json({ ok: false, error: e?.message ?? "upsert failed" });
        }
    });


}
