// src/routes/adminRoutes.ts
import type { Request, Response } from "express";
import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { marked } from "marked";
import passport, { requireAdmin, isGithubOAuthEnabled } from "../auth.js";
import { syncLabNotesFromFs } from "../services/syncLabNotesFromFs.js";
import { normalizeLocale, sha256Hex } from "../lib/helpers.js";

marked.setOptions({
    gfm: true,
    breaks: false, // ✅ strict
});


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
                            department_id, shadow_density, coherence_score,
                            safer_landing, read_time_minutes,
                            published_at,
                            created_at, updated_at
                        FROM v_lab_notes
                        ORDER BY
                            CASE WHEN status = 'published' THEN 0 ELSE 1 END,
                            published_at DESC,
                            updated_at DESC
                    `
                )
                .all();

            return res.json(rows);
        } catch (e: any) {
            return res.status(500).json({ error: "Database error", details: String(e?.message ?? e) });
        }
    });


    // ---------------------------------------------------------------------------
    // Admin: single Lab Note (protected)
    // ---------------------------------------------------------------------------
    app.get("/admin/notes/:slug", requireAdmin, (req: Request, res: Response) => {
        try {
            const slug = String(req.params.slug ?? "").trim();
            const locale = normalizeLocale(String(req.query.locale ?? "en"));

            if (!slug) return res.status(400).json({ error: "slug is required" });

            const row = db
                .prepare(
                    `
        SELECT
          id, slug, title, locale,
          type, status, dept,
          category, excerpt, summary,
          content_markdown,
          department_id, shadow_density, coherence_score,
          safer_landing, read_time_minutes,
          published_at,
          created_at, updated_at
        FROM v_lab_notes
        WHERE slug = ? AND locale = ?
        LIMIT 1
      `
                )
                .get(slug, locale);

            if (!row) return res.status(404).json({ error: "Not found" });
            return res.json(row);
        } catch (e: any) {
            return res.status(500).json({ error: "Database error", details: String(e?.message ?? e) });
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
                summary,
                content_markdown, // optional (empty allowed)
                department_id,
                shadow_density,
                coherence_score,
                safer_landing,
                read_time_minutes,
                published_at,
                type,
                status,
                dept,
            } = req.body ?? {};

            if (!title) return res.status(400).json({ error: "title is required" });
            if (!slug) return res.status(400).json({ error: "slug is required" });

            const noteLocale = normalizeLocale(locale);
            const noteType = String(type ?? "labnote");
            const noteStatus = String(status ?? (published_at ? "published" : "draft"));
            const normalizedPublishedAt =
                noteStatus === "published"
                    ? (published_at ?? new Date().toISOString().slice(0, 10))
                    : null;

            // Allow empty markdown so existing tests that only send metadata still pass.
            const bodyMarkdown = String(content_markdown ?? "");

            // ✅ Resolve canonical noteId by (slug, locale) to make upserts stable
            const existing = db
                .prepare("SELECT id, department_id, dept, type FROM lab_notes WHERE slug = ? AND locale = ?")
                .get(slug, noteLocale) as
                | { id: string; department_id: string | null; dept: string | null; type: string | null }
                | undefined;

            // If the row already exists, prefer its id over any incoming id.
            // This prevents “identity drift” where (slug, locale) updates a different id.
            const noteId = existing?.id ?? id ?? randomUUID();

            const incomingDepartment =
                typeof department_id === "string" && department_id.trim() ? department_id.trim() : null;

            const incomingDept =
                typeof dept === "string" && dept.trim() ? dept.trim() : null;

            // Preserve existing if not provided, else default for brand-new notes
            const resolvedDepartment =
                incomingDepartment ?? existing?.department_id ?? "SCMS";

            const resolvedDept =
                incomingDept ?? existing?.dept ?? null;

            // Type is identity-ish too; preserve if missing
            const resolvedType =
                (typeof type === "string" && type.trim() ? type.trim() : null) ?? existing?.type ?? "labnote";

            const tx = db.transaction(() => {
                // 1) Upsert metadata row (NO content_html writes, NO content_markdown column)
                db.prepare(`
                    INSERT INTO lab_notes (
                        id, title, slug, locale,
                        type, status, dept,
                        category, excerpt, summary,
                        department_id, shadow_density, coherence_score,
                        safer_landing, read_time_minutes, published_at,
                        updated_at
                    )
                    VALUES (
                               ?, ?, ?, ?,
                               ?, ?, ?,
                               ?, ?, ?,
                               ?, ?, ?,
                               ?, ?, ?,
                               strftime('%Y-%m-%dT%H:%M:%fZ','now')
                           )
                    ON CONFLICT(slug, locale) DO UPDATE SET
                                                            title=excluded.title,
                                                            type=excluded.type,
                                                            status=excluded.status,
                                                            dept = COALESCE(excluded.dept, lab_notes.dept),
                                                            category=excluded.category,
                                                            excerpt=excluded.excerpt,
                                                            summary=excluded.summary,
                                                            department_id = COALESCE(excluded.department_id, lab_notes.department_id),
                                                            shadow_density=excluded.shadow_density,
                                                            coherence_score=excluded.coherence_score,
                                                            safer_landing=excluded.safer_landing,
                                                            read_time_minutes=excluded.read_time_minutes,
                                                            published_at=excluded.published_at,
                                                            updated_at=excluded.updated_at
                `).run(
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

                    incomingDepartment,
                    shadow_density ?? 0,
                    coherence_score ?? 1.0,
                    safer_landing ? 1 : 0,
                    read_time_minutes ?? 5,

                    normalizedPublishedAt
                );

                // 2) Clear legacy HTML so nothing can “win” accidentally
                db.prepare(`UPDATE lab_notes SET content_html = NULL WHERE id = ?`).run(noteId);

                // 3) Compute next revision_num
                const revRow = db
                    .prepare(`
                        SELECT COALESCE(MAX(revision_num), 0) AS maxRev
                        FROM lab_note_revisions
                        WHERE note_id = ?
                    `)
                    .get(noteId) as { maxRev: number } | undefined;

                const nextRev = (revRow?.maxRev ?? 0) + 1;

                // 4) Create revision row (ledger truth)
                const revisionId = randomUUID();

                const prevPointer = db
                    .prepare(`
                        SELECT current_revision_id AS cur
                        FROM lab_notes
                        WHERE id = ?
                    `)
                    .get(noteId) as { cur?: string } | undefined;

                const frontmatter = {
                    id: noteId,
                    slug,
                    locale: noteLocale,
                    type: noteType,
                    title,
                    status: noteStatus,
                    published: normalizedPublishedAt ?? undefined,
                    dept: dept ?? null,
                    department_id: resolvedDepartment,
                    shadow_density: shadow_density ?? 0,
                    coherence_score: coherence_score ?? 1.0,
                    safer_landing: Boolean(safer_landing),
                    summary: summary || "",
                    excerpt: excerpt || "",
                    category: category || "Uncategorized",
                    read_time_minutes: read_time_minutes ?? 5,
                };

                const canonical = `${JSON.stringify(frontmatter)}\n---\n${bodyMarkdown}`;
                const contentHash = sha256Hex(canonical);

                db.prepare(`
                    INSERT INTO lab_note_revisions (
                        id, note_id, revision_num, supersedes_revision_id,
                        frontmatter_json, content_markdown, content_hash,
                        schema_version, source,
                        intent, intent_version,
                        scope_json, side_effects_json, reversible,
                        auth_type, scopes_json,
                        reasoning_json,
                        created_at
                    )
                    VALUES (
                               ?, ?, ?, ?,
                               ?, ?, ?,
                               ?, ?,
                               ?, ?,
                               ?, ?, ?,
                               ?, ?,
                               NULL,
                               strftime('%Y-%m-%dT%H:%M:%fZ','now')
                           )
                `).run(
                    revisionId,
                    noteId,
                    nextRev,
                    prevPointer?.cur ?? null,

                    JSON.stringify(frontmatter),
                    bodyMarkdown,
                    contentHash,

                    "0.1",
                    "web", // must satisfy CHECK constraint
                    "admin_save",
                    "1",

                    JSON.stringify(["db"]),
                    JSON.stringify(["update_note"]),
                    1,

                    "human_session",
                    JSON.stringify([])
                );

                // 5) Update pointers (current always points at latest save)
                db.prepare(`
                    UPDATE lab_notes
                    SET
                        current_revision_id = ?,
                        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
                    WHERE id = ?
                `).run(revisionId, noteId);

                // 6) Enforce publish/draft hard rules
                if (noteStatus === "published") {
                    db.prepare(`
                        UPDATE lab_notes
                        SET
                            published_revision_id = current_revision_id,
                            published_at = COALESCE(published_at, ?),
                            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
                        WHERE id = ?
                    `).run(
                        normalizedPublishedAt ?? new Date().toISOString().slice(0, 10),
                        noteId
                    );
                } else {
                    db.prepare(`
                        UPDATE lab_notes
                        SET
                            published_revision_id = NULL,
                            published_at = NULL,
                            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
                        WHERE id = ?
                    `).run(noteId);
                }

                return { noteId };
            });

            const { noteId: savedId } = tx();

            // Return canonical row with current ledger content
            const saved = db
                .prepare(`
                    SELECT
                        n.*,
                        r.content_markdown AS content_markdown,
                        r.frontmatter_json AS frontmatter_json
                    FROM lab_notes n
                             LEFT JOIN lab_note_revisions r ON r.id = n.current_revision_id
                    WHERE n.id = ?
                    LIMIT 1
                `)
                .get(savedId);

            return res.status(201).json(saved);
        } catch (e: any) {
            return res.status(500).json({
                error: "Database error",
                details: String(e?.message ?? e),
            });
        }
    });



    // ---------------------------------------------------------------------------
    // Admin: Publish Lab Note (protected)
    // ---------------------------------------------------------------------------
    // Admin: Publish by slug + locale
    app.post("/admin/notes/:slug/publish", requireAdmin, (req: Request, res: Response) => {
        try {
            const slug = String(req.params.slug ?? "").trim();
            const locale = normalizeLocale(String(req.query.locale ?? "en"));
            if (!slug) return res.status(400).json({ error: "slug is required" });

            const nowDate = new Date().toISOString().slice(0, 10);

            const row = db
                .prepare(`SELECT id FROM lab_notes WHERE slug = ? AND locale = ? LIMIT 1`)
                .get(slug, locale) as { id: string } | undefined;

            if (!row) return res.status(404).json({ error: "Not found" });

            db.prepare(`
      UPDATE lab_notes
      SET
        status = 'published',
        published_revision_id = current_revision_id,
        published_at = COALESCE(published_at, ?),
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?
    `).run(nowDate, row.id);

            return res.json({ ok: true, slug, locale, id: row.id, status: "published" });
        } catch (e: any) {
            return res.status(500).json({ error: "Database error", details: String(e?.message ?? e) });
        }
    });

    // ---------------------------------------------------------------------------
    // Admin: Un-publish Lab Note (protected)
    // ---------------------------------------------------------------------------
    app.post("/admin/notes/:slug/unpublish", requireAdmin, (req: Request, res: Response) => {
        try {
            const slug = String(req.params.slug ?? "").trim();
            const locale = normalizeLocale(String(req.query.locale ?? "en"));
            if (!slug) return res.status(400).json({ error: "slug is required" });

            const row = db
                .prepare(`SELECT id FROM lab_notes WHERE slug = ? AND locale = ? LIMIT 1`)
                .get(slug, locale) as { id: string } | undefined;

            if (!row) return res.status(404).json({ error: "Not found" });

            db.prepare(`
      UPDATE lab_notes
      SET
        status = 'draft',
        published_revision_id = NULL,
        published_at = NULL,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?
    `).run(row.id);

            return res.json({ ok: true, slug, locale, id: row.id, status: "draft" });
        } catch (e: any) {
            return res.status(500).json({ error: "Database error", details: String(e?.message ?? e) });
        }
    });


    // ---------------------------------------------------------------------------
    // Admin: Syncs MD Files to DB (protected)
    // ---------------------------------------------------------------------------
    app.post("/admin/notes/sync", requireAdmin, (req: any, res: { json: (arg0: { rootDir: string; locales: string[]; scanned: number; upserted: number; skipped: number; errors: Array<{ file: string; error: string; }>; ok: boolean; }) => void; status: (arg0: number) => { (): any; new(): any; json: { (arg0: { ok: boolean; error: any; }): void; new(): any; }; }; }) => {
        try {
            const result = syncLabNotesFromFs(db);
            res.json({ ok: true, ...result });
        } catch (e: any) {
            res.status(500).json({ ok: false, error: e?.message ?? String(e) });
        }
    });

    // ---------------------------------------------------------------------------
    // Auth helpers (always available)
    // ---------------------------------------------------------------------------
    const devBypass = process.env.ADMIN_DEV_BYPASS === "1";
    app.get("/auth/me", (req: Request, res: Response) => {
        if (devBypass) {
            return res.json({ user: { login: "ada" }, isAdmin: true });
        }
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
        app.get(
            "/auth/github",
            (req: { session: { oauth: { startedAt: number; ua: any; }; save: (arg0: (err: any) => void) => void; }; headers: { [x: string]: any; }; }, res: any, next: () => void) => {
                // ✅ Force session creation so Set-Cookie happens before redirect to GitHub
                req.session.oauth = {
                    startedAt: Date.now(),
                    ua: req.headers["user-agent"] ?? null,
                };
                req.session.save((err) => {
                    if (err) {
                        console.error("[auth/github] session.save failed", err);
                        // still attempt auth; worst case it fails and redirects to login
                    }
                    next();
                });
            },
            passport.authenticate("github", { scope: ["user:email"] })
        );


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
