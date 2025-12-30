// src/app.ts
import "./env.js";
import express from "express";
import cors from "cors";
import session from "express-session";
import passport, { configurePassport } from "./auth.js";
import { resolveDbPath, openDb, bootstrapDb, seedMarkerNote } from "./db.js";
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

    const isTest = env.NODE_ENV === "test";
    const isProd = env.NODE_ENV === "production";
    const uiOrigin = env.UI_BASE_URL ?? "http://localhost:5173";

    // If behind a proxy in prod (nginx/cloudflare), this matters for secure cookies
    app.set("trust proxy", 1);

    const dbPath = resolveDbPath();
    const db = openDb(dbPath);

    bootstrapDb(db);

    // Auto-seed: only in development if explicitly enabled
    if (env.NODE_ENV === "development" && env.DB_SEED === "1") {
        console.log("🌱 DB seed enabled — seeding dev DB…");
        seedDevDb(db);
    }

    seedMarkerNote(db);

    // ✅ CORS for cookies/sessions across different ports/origins
    app.use(
        cors({
            origin: uiOrigin,
            credentials: true,
        })
    );

    app.use(express.json());

    // OpenAPI validator (skip in test)
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

    // Configure passport strategy (no-op if oauth env missing)
    configurePassport();

    // Sessions must have a secret
    const sessionSecret = process.env.SESSION_SECRET;
    if (!sessionSecret && !isTest) {
        throw new Error("SESSION_SECRET is not set");
    }

    app.use(
        session({
            secret: sessionSecret ?? "test-secret", // tests only
            resave: false,
            saveUninitialized: false,
            cookie: {
                httpOnly: true,
                secure: isProd,         // prod HTTPS
                sameSite: isProd ? "none" : "lax", // ✅ dev ports OK; prod cross-site needs none
            },
        })
    );

    app.use(passport.initialize());
    app.use(passport.session());

    registerHealthRoutes(app, dbPath);
    registerLabNotesRoutes(app, db);
    registerAdminRoutes(app, db);
    registerOpenApiRoutes(app);

    return app;
}
