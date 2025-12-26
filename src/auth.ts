// src/auth.ts
import type { Request, Response, NextFunction } from "express";
import passport from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";

function requireEnv(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`Missing required env var: ${name}`);
    return v;
}

export function configurePassport() {
    // ✅ Tests should not require OAuth env vars
    if (process.env.NODE_ENV === "test") return;

    const clientID = requireEnv("GITHUB_OAUTH_CLIENT_ID");
    const clientSecret = requireEnv("GITHUB_OAUTH_CLIENT_SECRET");
    const callbackURL = requireEnv("GITHUB_OAUTH_CALLBACK_URL");

    if (!clientID || !clientSecret) {
        console.warn("⚠️ GitHub OAuth not configured; skipping auth setup");
        return;
    }

    passport.use(
        new GitHubStrategy(
            {
                clientID: clientID,
                clientSecret: clientSecret,
                callbackURL: callbackURL,
            },
            (_accessToken: string, _refreshToken: string, profile: any, done: any) => {
                if (profile.username !== process.env.ALLOWED_GITHUB_USERNAME) {
                    return done(new Error("Access denied"));
                }
                return done(null, profile);
            }
        )
    );

    passport.serializeUser((user: any, done) => done(null, user));
    passport.deserializeUser((user: any, done) => done(null, user));
}

export const ensureAuthenticated = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated?.()) return next();
    res.status(401).json({ error: "Unauthorized" });
};

export default passport;
