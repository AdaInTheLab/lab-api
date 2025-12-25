// src/auth.ts
import type { Request, Response, NextFunction } from "express";
import passport from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";

export function configurePassport() {
    // ✅ Tests should not require OAuth env vars
    if (process.env.NODE_ENV === "test") return;

    passport.use(
        new GitHubStrategy(
            {
                clientID: process.env.GITHUB_CLIENT_ID || "",
                clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
                callbackURL: "https://thehumanpatternlab.com/api/auth/github/callback",
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
