// tests/helpers/createTestApp.js
import express from "express";
import { registerHealthRoutes } from "../../src/routes/healthRoutes.js";
import { registerLabNotesRoutes } from "../../src/routes/labNotesRoutes.js";
import { registerAdminRoutes } from "../../src/routes/adminRoutes.js";
import { openDb, bootstrapDb, seedMarkerNote } from "../../src/db.js";

export function api(path) {
    const prefix = process.env.API_PREFIX ?? "";
    const p = path.startsWith("/") ? path : `/${path}`;
    return `${prefix}${p}`;
}

export function createTestApp() {
    const app = express();
    app.use(express.json());

    const db = openDb(":memory:");

    registerHealthRoutes(app, db);
    registerLabNotesRoutes(app, db);
    registerAdminRoutes(app, db);
    bootstrapDb(db);
    seedMarkerNote(db);
    return { app, db };
}
