import type { Request, Response } from "express";
import type Database from "better-sqlite3";
import { mintApiToken } from "../auth/tokens.js";
import { requireAdmin } from "../middleware/requireAdmin.js"; // your existing allowlist gate

export function registerAdminTokensRoutes(app: any, db: Database.Database) {
    // List (no raw tokens)
    app.get("/admin/tokens", requireAdmin, (_req: Request, res: Response) => {
        const rows = db.prepare(`
      SELECT id, label, scopes_json, is_active, expires_at, created_by_user, last_used_at, created_at
      FROM api_tokens
      ORDER BY created_at DESC
    `).all() as any[];

        const data = rows.map((r) => ({
            ...r,
            scopes: safeParseJsonArray(r.scopes_json),
        }));

        res.json({ ok: true, data });
    });

    // Mint (returns raw token ONCE)
    app.post("/admin/tokens", requireAdmin, (req: Request, res: Response) => {
        const { label, scopes, expires_at } = req.body ?? {};
        if (!label || typeof label !== "string") {
            return res.status(400).json({ ok: false, error: { code: "bad_request", message: "label is required" } });
        }
        if (!Array.isArray(scopes) || scopes.some((s) => typeof s !== "string")) {
            return res.status(400).json({ ok: false, error: { code: "bad_request", message: "scopes must be string[]" } });
        }

        const created_by_user = (req as any).user?.username ?? (req as any).user?.login ?? null;

        const minted = mintApiToken(db, {
            label,
            scopes,
            expires_at: typeof expires_at === "string" ? expires_at : null,
            created_by_user,
        });

        res.json({ ok: true, data: minted }); // includes raw token once
    });

    // Revoke
    app.post("/admin/tokens/:id/revoke", requireAdmin, (req: Request, res: Response) => {
        const { id } = req.params;
        db.prepare(`UPDATE api_tokens SET is_active = 0 WHERE id = ?`).run(id);
        res.json({ ok: true });
    });
}

function safeParseJsonArray(input: any): string[] {
    if (!input || typeof input !== "string") return [];
    try {
        const v = JSON.parse(input);
        if (Array.isArray(v)) return v.filter((x) => typeof x === "string");
        return [];
    } catch {
        return [];
    }
}
