// src/app.ts
import express from "express";
import cors from "cors";
import session from "express-session";
import dotenv from "dotenv";

import passport, { configurePassport } from "./auth.js";
import { resolveDbPath, openDb, bootstrapDb, seedMarkerNote } from "./db.js";
import { registerHealthRoutes } from "./routes/healthRoutes.js";
import { registerLabNotesRoutes } from "./routes/labNotesRoutes.js";
import { registerAdminRoutes } from "./routes/adminRoutes.js";

if (process.env.NODE_ENV !== "test") {
    dotenv.config();
}

export function createApp() {
    const app = express();

    const dbPath = resolveDbPath();
    const db = openDb(dbPath);

    bootstrapDb(db);
    seedMarkerNote(db);

    app.use(cors());
    app.use(express.json());

    app.use(
        session({
            secret: process.env.SESSION_SECRET ?? "default-secret-for-dev",
            resave: false,
            saveUninitialized: false,
        })
    );

    configurePassport();
    app.use(passport.initialize());
    app.use(passport.session());

    registerHealthRoutes(app, dbPath);
    registerLabNotesRoutes(app, db);
    registerAdminRoutes(app, db);

    // (Optional) remove or keep your debug root route, but don’t ship it.
    // app.get("/", ...)

    return app;
}
