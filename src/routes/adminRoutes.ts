// src/routes/adminRoutes.ts
import type { Request, Response } from "express";
import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import passport, { requireAdmin, isGithubOAuthEnabled } from "../auth.js";
import { normalizeLocale } from "@/lib/helpers.js";


export function registerAdminRoutes(app: any, db: Database.Database) {
    // If you're behind a proxy/SSL terminator, this must be set (and should not be conditional).

    const UI_BASE_URL = process.env.UI_BASE_URL ?? "http://localhost:8001";

    app.get("/admin/notes", requireAdmin, (_req: Request, res: Response) => {
        try {
            const rows = db.prepare(`
                SELECT
                    id, slug, title, locale,
                    type, status, dept,
                    category, excerpt, summary,
                    content_html,
                    department_id, shadow_density, coherence_score,
                    safer_landing, read_time_minutes, published_at,
                    created_at, updated_at
                FROM v_lab_notes
                ORDER BY published_at DESC, updated_at DESC

            `).all();

            res.json(rows);
        } catch (e: any) {
            res.status(500).json({ error: "Database error", details: String(e?.message ?? e) });
        }
    });

    // ---------------------------------------------------------------------------
    // Admin: upsert Lab Note (protected)
    // ---------------------------------------------------------------------------
    app.post("/admin/notes", requireAdmin, (req: Request, res: Response) => {
        try {
            const {
                id,
                title,
                slug,
                locale,
                category,
                excerpt,
                content_html,
                department_id,
                shadow_density,
                coherence_score,
                safer_landing,
                read_time_minutes,
                published_at,
                type,
                status,
                dept,
                summary,
                // tags, // keep for later
            } = req.body ?? {};

            if (!title) return res.status(400).json({ error: "title is required" });
            if (!slug) return res.status(400).json({ error: "slug is required" });

            const noteId = id ?? randomUUID();
            const noteLocale = normalizeLocale(locale);

            const noteType = String(type ?? "labnote");
            const noteStatus = String(status ?? (published_at ? "published" : "draft"));

            const normalizedPublishedAt =
                noteStatus === "published"
                    ? (published_at || new Date().toISOString().slice(0, 10))
                    : (published_at || null);

            const stmt = db.prepare(`
      INSERT INTO lab_notes (
        id, title, slug, locale,
        type, status, dept,
        category, excerpt, summary, content_html,
        department_id, shadow_density, coherence_score,
        safer_landing, read_time_minutes, published_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      ON CONFLICT(slug, locale) DO UPDATE SET
        title=excluded.title,
        type=excluded.type,
        status=excluded.status,
        dept=excluded.dept,
        category=excluded.category,
        excerpt=excluded.excerpt,
        summary=excluded.summary,
        content_html=excluded.content_html,
        department_id=excluded.department_id,
        shadow_density=excluded.shadow_density,
        coherence_score=excluded.coherence_score,
        safer_landing=excluded.safer_landing,
        read_time_minutes=excluded.read_time_minutes,
        published_at=excluded.published_at,
        updated_at=excluded.updated_at
    `);

            stmt.run(
                noteId,
                title,
                slug,
                noteLocale,

                noteType,
                noteStatus,
                dept ?? null,

                category || "Uncategorized",
                excerpt || "",
                summary || "",

                content_html || null,

                department_id || "SCMS",
                shadow_density ?? 0,
                coherence_score ?? 1.0,
                safer_landing ? 1 : 0,
                read_time_minutes ?? 5,

                normalizedPublishedAt
            );

            return res.status(201).json({
                id: noteId,
                slug,
                locale: noteLocale,
                type: noteType,
                status: noteStatus,
                message: "Note saved with energetic metadata",
            });
        } catch (e: any) {
            return res.status(500).json({
                error: "Database error",
                details: String(e?.message ?? e),
            });
        }
    });


    // ---------------------------------------------------------------------------
    // Auth helpers (always available)
    // ---------------------------------------------------------------------------
    app.get("/auth/me", (req: Request, res: Response) => {
        res.json({ user: (req as any).user ?? null });
    });

    app.post("/auth/logout", (req: Request, res: Response) => {
        // Passport compatibility: some versions require callback
        const done = () => res.json({ ok: true });

        try {
            const anyReq = req as any;
            if (typeof anyReq.logout === "function") {
                // If logout expects a callback, pass it; otherwise just call it.
                if (anyReq.logout.length > 0) return anyReq.logout(done);
                anyReq.logout();
            }
            return done();
        } catch {
            return done();
        }
    });

    // ---------------------------------------------------------------------------
    // GitHub OAuth (only if enabled)
    // ---------------------------------------------------------------------------
    if (isGithubOAuthEnabled()) {
        app.get("/auth/github", passport.authenticate("github", { scope: ["user:email"] }));

        app.get(
            "/auth/github/callback",
            passport.authenticate("github", {
                failureRedirect: `${UI_BASE_URL}/login`,
                session: true,
            }),
            (_req: Request, res: Response) => {
                res.redirect(`${UI_BASE_URL}/admin`);
            }
        );
    } else {
        // Optional: make it obvious why /auth/github "doesn't exist" when disabled
        app.get("/auth/github", passport.authenticate("github", { scope: ["user:email"] }));

        app.get(
            "/auth/github/callback",
            passport.authenticate("github", {
                failureRedirect: `${UI_BASE_URL}/login`,
                session: true,
            }),
            (_req: any, res: { redirect: (arg0: string) => any; }) => res.redirect(`${UI_BASE_URL}/admin`)
        );
        app.get("/github/status", (_req: any, res: { json: (arg0: { enabled: boolean; }) => void; }) => {
            res.json({ enabled: isGithubOAuthEnabled() });
        });
    }
}
