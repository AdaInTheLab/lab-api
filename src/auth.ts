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
            (_accessToken: any, _refreshToken: any, profile: any, done: (arg0: null, arg1: boolean) => any) => {
                const allowed = process.env.ALLOWED_GITHUB_USERNAME;
                if (allowed && profile?.username !== allowed) return done(null, false);
                return done(null, profile);
            }
        )
    );

    passport.serializeUser((user: any, done) => done(null, user));
    passport.deserializeUser((user: any, done) => done(null, user));
}

export const ensureAuthenticated = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated?.()) return next();
    return res.status(401).json({ error: "Unauthorized" });
};

export default passport;
1