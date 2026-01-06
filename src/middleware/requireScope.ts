import type { Request, Response, NextFunction } from "express";

export function requireScope(scope: string) {
    return (req: Request, res: Response, next: NextFunction) => {
        const scopes = req.auth?.scopes ?? [];
        if (scopes.includes("admin") || scopes.includes(scope) || scopes.includes(`${scope.split(":")[0]}:*`)) {
            return next();
        }
        return res.status(403).json({ error: "Forbidden" });
    };
}
