// src/routes/labNotesRoutes.ts
import type { Request, Response } from "express";
import type Database from "better-sqlite3";
import type { LabNoteRecord, TagResult } from "../types/labNotes.js";
import { mapToLabNotePreview, mapToLabNoteView } from "../mappers/labNotesMapper.js";

export function registerLabNotesRoutes(app: any, db: Database.Database) {
    // Public: Lab Notes list (preview)
    app.get("/lab-notes", (_req: Request, res: Response) => {
        const notes = db.prepare(`
            SELECT
                id, slug, title, excerpt, content_html, content_md,
                department_id, shadow_density, coherence_score,
                safer_landing, read_time_minutes, published_at, category
            FROM v_lab_notes
            ORDER BY published_at DESC
        `).all() as LabNoteRecord[];

        const mapped = notes.map((note) => {
            const tagRows = db
                .prepare("SELECT tag FROM lab_note_tags WHERE note_id = ?")
                .all(note.id) as TagResult[];

            return mapToLabNotePreview(note, tagRows.map((t) => t.tag));
        });

        res.json(mapped);
    });

    // Public: single Lab Note (detail)
    app.get("/lab-notes/:slug", (req: Request, res: Response) => {
        const { slug } = req.params;

        const note = db.prepare(`
          SELECT
            id, slug, title, excerpt, content_html, content_md,
            department_id, shadow_density, coherence_score,
            safer_landing, read_time_minutes, published_at, category
          FROM v_lab_notes
          WHERE slug = ?
        `).get(slug) as LabNoteRecord | undefined;


        if (!note) return res.status(404).json({ error: "Not found" });

        const tagRows = db
            .prepare("SELECT tag FROM lab_note_tags WHERE note_id = ?")
            .all(note.id) as TagResult[];

        res.json(mapToLabNoteView(note, tagRows.map((t) => t.tag)));
    });
}
