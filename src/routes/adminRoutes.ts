// src/routes/adminRoutes.ts
import type { Request, Response } from "express";
import type Database from "better-sqlite3";
import { ensureAuthenticated } from "../auth.js";

export function registerAdminRoutes(app: any, db: Database.Database) {
    app.post("/admin/notes", ensureAuthenticated, (req: Request, res: Response) => {
        const {
            id, title, slug, category, excerpt,
            content_html, content_md,
            department_id, shadow_density, coherence_score,
            safer_landing, read_time_minutes, published_at
        } = req.body;

        const stmt = db.prepare(`
      INSERT OR REPLACE INTO lab_notes (
        id, title, slug, category, excerpt,
        content_html, content_md,
        department_id, shadow_density, coherence_score,
        safer_landing, read_time_minutes, published_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        try {
            stmt.run(
                id || Date.now().toString(),
                title,
                slug,
                category || "Uncategorized",
                excerpt || "",
                content_html || null,
                content_md || null,
                department_id || "SCMS",
                shadow_density || 0,
                coherence_score || 1.0,
                safer_landing ? 1 : 0,
                read_time_minutes || 5,
                published_at || new Date().toISOString().split("T")[0]
            );
            res.status(201).json({ message: "Note saved with energetic metadata" });
        } catch {
            res.status(500).json({ error: "Database error" });
        }
    });
}
