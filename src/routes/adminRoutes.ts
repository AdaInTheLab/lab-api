// src/routes/adminRoutes.ts
import type { Request, Response } from "express";
import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import passport, { ensureAuthenticated, isGithubOAuthEnabled } from "../auth.js";

export function registerAdminRoutes(app: any, db: Database.Database) {
    // Ensure slug uniqueness (safe to run repeatedly)
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_lab_notes_slug ON lab_notes(slug);`);

    app.post("/admin/notes", ensureAuthenticated, (req: Request, res: Response) => {
        const {
            id,
            title,
            slug,
            category,
            excerpt,
            content_html,
            content_md,
            department_id,
            shadow_density,
            coherence_score,
            safer_landing,
            read_time_minutes,
            published_at,
        } = req.body;

        if (!title) return res.status(400).json({ error: "title is required" });
        if (!slug) return res.status(400).json({ error: "slug is required" });

        const noteId = id ?? randomUUID();

        const stmt = db.prepare(`
              INSERT INTO lab_notes (
                id, title, slug, category, excerpt,
                content_html, content_md,
                department_id, shadow_density, coherence_score,
                safer_landing, read_time_minutes, published_at
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(slug) DO UPDATE SET
                title=excluded.title,
                category=excluded.category,
                excerpt=excluded.excerpt,
                content_html=excluded.content_html,
                content_md=excluded.content_md,
                department_id=excluded.department_id,
                shadow_density=excluded.shadow_density,
                coherence_score=excluded.coherence_score,
                safer_landing=excluded.safer_landing,
                read_time_minutes=excluded.read_time_minutes,
                published_at=excluded.published_at
            `);

        try {
            stmt.run(
                noteId,
                title,
                slug,
                category || "Uncategorized",
                excerpt || "",
                content_html || null,
                content_md || null,
                department_id || "SCMS",
                shadow_density ?? 0,
                coherence_score ?? 1.0,
                safer_landing ? 1 : 0,
                read_time_minutes ?? 5,
                published_at || new Date().toISOString().split("T")[0]
            );

            res.status(201).json({ id: noteId, slug, message: "Note saved with energetic metadata" });
        } catch (e: any) {
            // If unique constraint hits, you’ll see it here
            res.status(500).json({ error: "Database error", details: String(e?.message ?? e) });
        }
    });

    if (isGithubOAuthEnabled()) {
        // Start GitHub OAuth
        app.get(
            "/api/auth/github",
            passport.authenticate("github", {scope: ["user:email"]})
        );

        // GitHub OAuth callback
        app.get(
            "/api/auth/github/callback",
            passport.authenticate("github", {
                failureRedirect: "/login",
                session: true,
            }),
            (_req: Request, res: Response) => {
                res.redirect("/admin");
            }
        );
    }
    // Optional helpers (very useful)
    app.get("/api/auth/me", (req: Request, res: Response) => {
        res.json({ user: req.user ?? null });
    });

    app.post("/api/auth/logout", (req: Request, res: Response) => {
        req.logout(() => {
            res.json({ ok: true });
        });
    });
}
