// src/routes/adminRoutes.ts
import type { Request, Response } from "express";
import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import passport, { requireAdmin, isGithubOAuthEnabled } from "../auth.js";
import { normalizeLocale } from "../lib/helpers.js";

export function registerAdminRoutes(app: any, db: Database.Database) {
    // Must match your UI origin exactly (no trailing slash)
    const UI_BASE_URL = process.env.UI_BASE_URL ?? "http://localhost:8001";

    // ---------------------------------------------------------------------------
    // Admin: list Lab Notes (protected)
    // ---------------------------------------------------------------------------
    app.get("/admin/notes", requireAdmin, (_req: Request, res: Response) => {
        try {
            const rows = db
                .prepare(
                    `
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
        `
                )
                .all();

            return res.json(rows);
        } catch (e: any) {
            return res
                .status(500)
                .json({ error: "Database error", details: String(e?.message ?? e) });
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
                    ? published_at || new Date().toISOString().slice(0, 10)
                    : published_at || null;

            const stmt = db.prepare(`
        INSERT INTO lab_notes (
          id, title, slug, locale,
          type, status, dept,
          category, excerpt, summary, content_html,
          department_id, shadow_density, coherence_score,
          safer_landing, read_time_minutes, published_at,
          updated_at
        )
        VALUES (
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          strftime('%Y-%m-%dT%H:%M:%fZ','now')
        )
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
        const user = (req as any).user ?? null;
        if (!user) return res.status(401).json({ user: null });
        return res.json({ user });
    });

    app.post("/auth/logout", (req: Request, res: Response) => {
        const done = () => res.json({ ok: true });

        try {
            const anyReq = req as any;
            if (typeof anyReq.logout === "function") {
                if (anyReq.logout.length > 0) return anyReq.logout(done);
                anyReq.logout();
            }
            return done();
        } catch {
            return done();
        }
    });

    // Simple status endpoint (handy for debugging)
    app.get("/github/status", (_req: Request, res: Response) => {
        res.json({ enabled: isGithubOAuthEnabled() });
    });

    // ---------------------------------------------------------------------------
    // GitHub OAuth
    // ---------------------------------------------------------------------------
    if (isGithubOAuthEnabled()) {
        app.get("/auth/github", passport.authenticate("github", { scope: ["user:email"] }));

        app.get("/auth/github/callback", (req: { headers: { cookie: any; }; sessionID: any; logIn: (arg0: any, arg1: (e: any) => any) => void; }, res: {
            redirect: (arg0: string) => any;
        }, next: any) => {
            passport.authenticate("github", (err: { message: any; }, user: any, info: any) => {
                console.log("[auth/github/callback]", {
                    err: err?.message ?? null,
                    info,
                    hasUser: Boolean(user),
                    hasCookieHeader: Boolean(req.headers.cookie),
                    sessionID: req.sessionID,
                });

                if (err || !user) {
                    return res.redirect(`${UI_BASE_URL}/admin/login?oauth=failed`);
                }

                req.logIn(user, (e) => {
                    if (e) {
                        console.log("[auth/github/callback] req.logIn failed", e);
                        return res.redirect(`${UI_BASE_URL}/admin/login?oauth=login_failed`);
                    }
                    return res.redirect(`${UI_BASE_URL}/admin/dashboard`);
                });
            })(req, res, next);
        });
    } else {
        // Fail loudly/clearly when OAuth is not configured
        app.get("/auth/github", (_req: Request, res: Response) => {
            res.status(503).json({ error: "GitHub OAuth disabled" });
        });

        app.get("/auth/github/callback", (_req: Request, res: Response) => {
            res.status(503).json({ error: "GitHub OAuth disabled" });
        });
    }
}
