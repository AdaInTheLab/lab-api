// src/auth.ts
import type { Request, Response, NextFunction } from "express";
import passport from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";

type EnvKey = "CLIENT_ID" | "CLIENT_SECRET" | "CALLBACK_URL";

/**
 * Prefer non-reserved prefixes for GitHub Actions secrets/env.
 * - OAUTH_GITHUB_* (recommended)
 * - HPL_OAUTH_GITHUB_* (also fine)
 * Fallback to GITHUB_OAUTH_* for backwards compatibility (server/local only).
 */
function getGithubOAuthEnv(key: EnvKey): string | undefined {
    return (
        process.env[`OAUTH_GITHUB_${key}`] ||
        process.env[`HPL_OAUTH_GITHUB_${key}`] ||
        process.env[`GITHUB_OAUTH_${key}`]
    );
}

export function configurePassport() {
    // ✅ Tests should not require OAuth env vars
    if (process.env.NODE_ENV === "test") return;

    const clientID = getGithubOAuthEnv("CLIENT_ID");
    const clientSecret = getGithubOAuthEnv("CLIENT_SECRET");
    const callbackURL = getGithubOAuthEnv("CALLBACK_URL");

    // If any are missing, don't crash the whole API.
    if (!clientID || !clientSecret || !callbackURL) {
        console.warn(
            "⚠️ GitHub OAuth not configured; skipping auth setup. " +
            "Set OAUTH_GITHUB_CLIENT_ID / OAUTH_GITHUB_CLIENT_SECRET / OAUTH_GITHUB_CALLBACK_URL."
        );
        return;
    }

    passport.use(
        new GitHubStrategy(
            {
                clientID,
                clientSecret,
                callbackURL,
            },
            (_accessToken: string, _refreshToken: string, profile: any, done: any) => {
                const allowed = process.env.ALLOWED_GITHUB_USERNAME;

                // If you want to require this, you can enforce it.
                // For now: if not set, allow any authenticated GitHub user.
                if (allowed && profile?.username !== allowed) {
                    return done(new Error("Access denied"));
                }
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
    res.status(401).json({ error: "Unauthorized" });
};

export default passport;
