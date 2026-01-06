// src/auth.ts
import type { Request, Response, NextFunction } from "express";
import passport from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";

type EnvKey = "CLIENT_ID" | "CLIENT_SECRET" | "CALLBACK_URL";

function getGithubOAuthEnv(key: EnvKey): string | undefined {
    return (
        process.env[`OAUTH_GITHUB_${key}`] ||
        process.env[`HPL_OAUTH_GITHUB_${key}`] ||
        process.env[`GITHUB_OAUTH_${key}`]
    );
}

export function isGithubOAuthEnabled(): boolean {
    if (process.env.NODE_ENV === "test") return false;
    return Boolean(
        getGithubOAuthEnv("CLIENT_ID") &&
        getGithubOAuthEnv("CLIENT_SECRET") &&
        getGithubOAuthEnv("CALLBACK_URL")
    );
}

function missingGithubOAuthKeys(): EnvKey[] {
    const keys: EnvKey[] = ["CLIENT_ID", "CLIENT_SECRET", "CALLBACK_URL"];
    return keys.filter((k) => !getGithubOAuthEnv(k));
}

function parseAllowlist(envValue?: string): string[] {
    return String(envValue ?? "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
}

/**
 * ✅ Single source of truth for admin allowlist
 * Supports:
 * - ADMIN_GITHUB_USERS (comma-separated)
 * - ADMIN_GITHUB_LOGINS (comma-separated)
 * - ALLOWED_GITHUB_USERNAME (single)  (kept for backwards compat)
 */
function buildAdminAllowlist(): Set<string> {
    return new Set<string>([
        ...parseAllowlist(process.env.ADMIN_GITHUB_USERS),
        ...parseAllowlist(process.env.ADMIN_GITHUB_LOGINS),
        ...parseAllowlist(process.env.ALLOWED_GITHUB_USERNAME),
    ]);
}

export function getGithubLogin(user: any): string | null {
    const raw = String(user?.username ?? user?.login ?? "").trim();
    return raw ? raw.toLowerCase() : null;
}

/**
 * Passport configuration:
 * - Authenticate ANY valid GitHub user (no allowlist here)
 * - Authorization happens in requireAdmin (single gate)
 */
export function configurePassport() {
    if (process.env.NODE_ENV === "test") return;

    const missing = missingGithubOAuthKeys();
    if (missing.length > 0) {
        console.warn(
            `⚠️ GitHub OAuth disabled (missing: ${missing.join(", ")}). ` +
            `Provide one of: OAUTH_GITHUB_*, HPL_OAUTH_GITHUB_*, or GITHUB_OAUTH_* variants.`
        );
        return;
    }

    const clientID = getGithubOAuthEnv("CLIENT_ID")!;
    const clientSecret = getGithubOAuthEnv("CLIENT_SECRET")!;
    const callbackURL = getGithubOAuthEnv("CALLBACK_URL")!;

    passport.use(
        new GitHubStrategy(
            { clientID, clientSecret, callbackURL },
            (_accessToken: any, _refreshToken: any, profile: any, done: any) => {
                // ✅ Authentication only (no allowlist here)
                // Keep profile minimal if you want, but leaving it as-is is fine for now.
                return done(null, profile);
            }
        )
    );

    passport.serializeUser((user: any, done) => done(null, user));
    passport.deserializeUser((user: any, done) => done(null, user));
}

export const ensureAuthenticated = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (req.isAuthenticated?.()) return next();
    return res.status(401).json({ error: "Unauthorized" });
};

/**
 * Admin gate (API-side). Use this on /admin/* routes.
 *
 * Semantics:
 * - 401: not authenticated (no session)
 * - 403: authenticated but not authorized OR allowlist not configured (prod)
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    // ✅ DEV BYPASS (explicit opt-in, never works in production)
    if (
        process.env.NODE_ENV !== "production" &&
        process.env.ADMIN_DEV_BYPASS === "true"
    ) {
        return next();
    }

    const allow = buildAdminAllowlist();

    // Fail-closed when misconfigured (production only).
    if (allow.size === 0 && process.env.NODE_ENV === "production") {
        return res.status(403).json({ error: "Admin not configured" });
    }

    if (!req.isAuthenticated?.()) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const login = getGithubLogin((req as any).user);
    if (!login) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    // If allowlist exists, enforce it (case-insensitive by construction)
    if (allow.size > 0 && !allow.has(login)) {
        return res.status(403).json({ error: "Forbidden" });
    }

    return next();
};

export default passport;
