import type { Request, Response, NextFunction } from "express";

function getBearerToken(req: Request): string | null {
    const h = req.header("authorization");
    if (!h) return null;
    const m = /^Bearer\s+(.+)$/i.exec(h);
    return m?.[1] ?? null;
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "unauthorized", message: "Missing bearer token" });

    try {
        // Validate token by asking GitHub who it belongs to.
        // GitHub returns the authenticated user for a valid token.
        const ghRes = await fetch("https://api.github.com/user", {
            headers: {
                Authorization: `Bearer ${token}`,
                "User-Agent": "human-pattern-lab-api"
            }
        });

        if (!ghRes.ok) {
            return res.status(401).json({ error: "unauthorized", message: "Invalid GitHub token" });
        }

        const user = (await ghRes.json()) as { login?: string };

        // OPTIONAL (recommended): restrict to an allowlist.
        // Set ADMIN_GITHUB_LOGINS="AdaVale,OtherAdmin" in env.
        const allow = (process.env.ADMIN_GITHUB_LOGINS ?? "")
            .split(",")
            .map(s => s.trim())
            .filter(Boolean);

        if (allow.length > 0 && (!user.login || !allow.includes(user.login))) {
            return res.status(403).json({ error: "forbidden", message: "Not an admin" });
        }

        // Optionally attach for downstream
        (req as any).adminLogin = user.login;

        return next();
    } catch (err) {
        return res.status(500).json({ error: "server_error", message: "Auth check failed" });
    }
}
