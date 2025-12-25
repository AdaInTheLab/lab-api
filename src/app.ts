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
import OpenApiValidator from "express-openapi-validator";
import { registerOpenApiRoutes } from "./routes/openapiRoutes.js";
import fs from "node:fs";
import path from "node:path";

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

    const isTest = process.env.NODE_ENV === "test";
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

    // Optional: also guard this route registration, or let openapiRoutes.ts guard internally
    registerOpenApiRoutes(app);

    return app;
}