// src/routes/healthRoutes.ts
import type { Request, Response } from "express";

export function registerHealthRoutes(app: any, dbPath: string) {
    app.get("/health", (_req: Request, res: Response) => {
        res.json({ status: "ok", dbPath });
    });
}
