import type { Request, Response, NextFunction } from "express";

function getAuthToken(req: Request): string | null {
    const h = req.header("authorization");
    if (!h) return null;

    // Accept: "Bearer xxx" or "token xxx"
    const m = /^(Bearer|token)\s+(.+)$/i.exec(h.trim());
    return m?.[2] ?? null;
}

// tiny cache: token -> { login, expiresAt }
const tokenCache = new Map<string, { login: string; expiresAt: number }>();
const CACHE_MS = 60_000; // 1 minute (adjust as desired)

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
    const token = getAuthToken(req);
    if (!token) {
        return res.status(401).json({ error: "unauthorized", message: "Missing Authorization token" });
    }

    // Cache hit?
    const cached = tokenCache.get(token);
    if (cached && cached.expiresAt > Date.now()) {
        (req as any).adminLogin = cached.login;
        return next();
    }

    try {
        const ghRes = await fetch("https://api.github.com/user", {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
                "User-Agent": "human-pattern-lab-api",
            },
        });

        // Helpful differentiation for debugging
        if (ghRes.status === 401) {
            return res.status(401).json({ error: "unauthorized", message: "Invalid GitHub token" });
        }
        if (ghRes.status === 403) {
            // could be rate limiting or token restriction
            const remaining = ghRes.headers.get("x-ratelimit-remaining");
            const msg =
                remaining === "0"
                    ? "GitHub rate limit exceeded (try again later)"
                    : "Forbidden by GitHub (token may lack scopes or be restricted)";
            return res.status(403).json({ error: "forbidden", message: msg });
        }
        if (!ghRes.ok) {
            return res.status(502).json({ error: "bad_gateway", message: "GitHub auth check failed" });
        }

        const user = (await ghRes.json()) as { login?: string };
        const login = user.login?.trim();

        if (!login) {
            return res.status(401).json({ error: "unauthorized", message: "GitHub token user unknown" });
        }

        // Optional allowlist: ADMIN_GITHUB_LOGINS="AdaVale,OtherAdmin"
        const allow = (process.env.ADMIN_GITHUB_LOGINS ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

        if (allow.length > 0 && !allow.includes(login)) {
            return res.status(403).json({ error: "forbidden", message: "Not an admin" });
        }

        tokenCache.set(token, { login, expiresAt: Date.now() + CACHE_MS });
        (req as any).adminLogin = login;

        return next();
    } catch {
        return res.status(500).json({ error: "server_error", message: "Auth check failed" });
    }
}
