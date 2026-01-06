import type { Request, Response, NextFunction } from "express";
import type Database from "better-sqlite3";
import { verifyApiToken } from "@/auth/tokens.js";
import { getGithubLogin } from "@/auth.js";

export type AuthContext =
    | { kind: "session"; login: string; scopes: string[] }
    | { kind: "token"; tokenId: string; label: string; scopes: string[] };

declare global {
    namespace Express {
        interface Request {
            auth?: AuthContext;
        }
    }
}

function getAuthToken(req: Request): string | null {
    const h = req.header("authorization");
    if (!h) return null;
    const m = /^(Bearer|token)\s+(.+)$/i.exec(h.trim());
    return m?.[2] ?? null;
}

export function requireAuth(db: Database.Database) {
    return (req: Request, res: Response, next: NextFunction) => {
        // 1) Human session auth
        if (req.isAuthenticated?.() && (req as any).user) {
            const login = getGithubLogin((req as any).user);
            if (login) {
                req.auth = { kind: "session", login, scopes: ["admin"] };
                return next();
            }
        }

        // 2) Bearer token auth
        const raw = getAuthToken(req);
        if (raw) {
            const verified = verifyApiToken(db, raw);
            if (verified) {
                req.auth = {
                    kind: "token",
                    tokenId: verified.token.id,
                    label: verified.token.label,
                    scopes: verified.scopes,
                };
                return next();
            }
        }

        return res.status(401).json({ error: "Unauthorized" });
    };
}
