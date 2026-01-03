import type { Request, Response, NextFunction } from "express";
import { getGithubLogin } from "../auth.js";

function getAuthToken(req: Request): string | null {
    const h = req.header("authorization");
    if (!h) return null;
    const m = /^(Bearer|token)\s+(.+)$/i.exec(h.trim());
    return m?.[2] ?? null;
}

function parseAllowlist(envValue?: string): string[] {
    return String(envValue ?? "")
        .split(",")
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);
}

function getSessionLogin(req: Request): string | null {
    // passport-github2 typically gives profile.username
    const u: any = (req as any).user;
    const login = (u?.username ?? u?.login ?? "").toString().trim();
    return login ? login.toLowerCase() : null;
}

// tiny cache: token -> { login, expiresAt }
const tokenCache = new Map<string, { login: string; expiresAt: number }>();
const CACHE_MS = 60_000;

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    // ✅ DEV BYPASS (explicit opt-in, never in production)
    if (
        process.env.NODE_ENV !== "production" &&
        process.env.ADMIN_DEV_BYPASS === "true"
    ) {
        return next();
    }
    // 1) Not logged in? -> 401
    if (!req.isAuthenticated?.()) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const login = getGithubLogin((req as any).user);
    if (!login) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    // 2) Now check allowlist
    const allow = new Set<string>([
        ...parseAllowlist(process.env.ADMIN_GITHUB_USERS),
        ...parseAllowlist(process.env.ADMIN_GITHUB_LOGINS),
        ...parseAllowlist(process.env.ALLOWED_GITHUB_USERNAME),
    ]);

    // 3) If no allowlist is configured, fail closed (prod + everywhere if you prefer)
    if (allow.size === 0) {
        return res.status(403).json({ error: "Admin not configured" });
    }

    // 4) Logged in but not allowed -> 403
    if (!allow.has(login)) {
        return res.status(403).json({ error: "Forbidden" });
    }

    return next();
};

