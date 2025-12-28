// src/app.ts
import express from "express";
import cors from "cors";
import session from "express-session";

import passport, { configurePassport } from "./auth.js";
import { resolveDbPath, openDb, bootstrapDb, seedMarkerNote, isDbEmpty } from "./db.js";
import { registerHealthRoutes } from "./routes/healthRoutes.js";
import { registerLabNotesRoutes } from "./routes/labNotesRoutes.js";
import { registerAdminRoutes } from "./routes/adminRoutes.js";
import OpenApiValidator from "express-openapi-validator";
import { registerOpenApiRoutes } from "./routes/openapiRoutes.js";
import fs from "node:fs";
import path from "node:path";
import { env } from "./env.js";
import { seedDevDb } from "./seed/devSeed.js";

export function createApp() {
    const app = express();

    const dbPath = resolveDbPath();
    const db = openDb(dbPath);

    bootstrapDb(db);

    // Auto-seed: only once, only in development, only if empty
    if (env.NODE_ENV === "development" && isDbEmpty(db)) {
        console.log("🌱 DB empty in development — auto-seeding…");
        seedDevDb(db);
    }

    // Optional: marker note is fine, but only after seeding (so it doesn't block "empty" detection)
    seedMarkerNote(db);

    app.use(cors());
    app.use(express.json());

    const isTest = env.NODE_ENV === "test";
    const specPath = path.join(process.cwd(), "openapi", "openapi.json");

    if (!isTest && fs.existsSync(specPath)) {
        app.use(
            OpenApiValidator.middleware({
                apiSpec: specPath,
                validateRequests: true,
                validateResponses: false,
            })
        );
    } else if (!isTest) {
        console.warn(`⚠️ OpenAPI spec not found at ${specPath}. Skipping openapi-validator.`);
    }

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

    registerOpenApiRoutes(app);

    return app;
}
