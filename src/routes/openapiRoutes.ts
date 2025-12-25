import type { Express } from "express";
import path from "node:path";
import fs from "node:fs";
import { requireAdmin } from "../middleware/requireAdmin.js";

export function registerOpenApiRoutes(app: Express) {
    const specPath = path.join(process.cwd(), "openapi", "openapi.json");

    if (!fs.existsSync(specPath)) {
        // Don’t crash the app over docs. Just skip.
        console.warn(`⚠️ OpenAPI spec not found at ${specPath}. Skipping /openapi.json route.`);
        return;
    }

    const spec = JSON.parse(fs.readFileSync(specPath, "utf8")) as object;

    app.get("/openapi.json", requireAdmin, (_req, res) => res.json(spec));
}
