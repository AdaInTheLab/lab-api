// src/app.ts
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
    /* ===========================================================
       1) APP CREATION (FIRST)
       -----------------------------------------------------------
       Create the Express app immediately, then attach the handful
       of "must be early" settings and middleware.
       =========================================================== */
    const app = express();

    /* ===========================================================
       2) TRUST PROXY (VERY EARLY)
       -----------------------------------------------------------
       If you're behind a reverse proxy (nginx, Cloudflare, etc),
       Express needs this to correctly detect HTTPS.

       Why it matters:
       - In production we often use secure cookies.
       - secure cookies require the request to be recognized as HTTPS.
       - Without trust proxy, req.secure may be false, and cookies
         can silently fail to set -> "login succeeded then bounced".
       =========================================================== */
    app.set("trust proxy", 1);

    /* ===========================================================
       3) BODY PARSING (EARLY, ONCE)
       -----------------------------------------------------------
       Parse JSON/form bodies before routes so handlers can read
       req.body. Only do this once (duplicates are harmless-ish,
       but it becomes confusing fast).
       =========================================================== */
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    /* ===========================================================
       4) ENV + TOPOLOGY FLAGS
       -----------------------------------------------------------
       These drive cookie strategy (sameSite/secure) and whether
       certain middleware (like OpenAPI validation) runs in tests.
       =========================================================== */
    const isTest = env.NODE_ENV === "test";
    const isProd = env.NODE_ENV === "production";

    // This must match the browser's Origin exactly (no trailing slash).
    // Example: "https://thehumanpatternlab.com"
    const uiOrigin = env.UI_BASE_URL ?? "http://localhost:5173";

    /* ===========================================================
       5) CORS (BEFORE SESSION IF CROSS-ORIGIN)
       -----------------------------------------------------------
       If your UI and API are on different origins (domain/subdomain/
       port), your browser will treat requests as cross-origin.

       Why it matters for auth:
       - Cross-origin cookies require:
           CORS credentials: true
           session cookie sameSite: "none"
           session cookie secure: true (HTTPS)
       - If ANY ONE of those is missing, cookies won't stick and
         you'll loop back to /login.
       =========================================================== */
    app.use(
        cors({
            origin: uiOrigin,
            credentials: true,
        })
    );

// ✅ Force-handle ALL preflight requests
    app.options(/.*/, cors({ origin: uiOrigin, credentials: true }));
    app.use((req, _res, next) => {
        if (req.method === "OPTIONS") {
            console.log("🧪 Preflight:", req.headers.origin, req.headers["access-control-request-method"], req.url);
        }
        next();
    });
    /* ===========================================================
       6) DATABASE BOOTSTRAP (EARLY)
       -----------------------------------------------------------
       You can open/init the DB before auth middleware.
       This keeps system startup deterministic.
       =========================================================== */
    const dbPath = resolveDbPath();
    const db = openDb(dbPath);

    bootstrapDb(db);

    // Auto-seed: only in development if explicitly enabled
    if (env.NODE_ENV === "development" && env.DB_SEED === "1") {
        console.log("🌱 DB seed enabled — seeding dev DB…");
        seedDevDb(db);
    }

    seedMarkerNote(db);

    /* ===========================================================
       7) OPENAPI VALIDATOR (OPTIONAL, BEFORE ROUTES)
       -----------------------------------------------------------
       Validates request shapes before they hit your handlers.
       Skip in tests if you want leaner/more flexible test calls.
       =========================================================== */
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

    /* ===========================================================
       8) PASSPORT STRATEGY CONFIG (ONCE)
       -----------------------------------------------------------
       This sets up OAuth strategies, serialize/deserialize, etc.
       It's fine to do before session/passport middleware.
       =========================================================== */
    configurePassport();

    /* ===========================================================
       9) SESSION SETUP (MUST BE BEFORE passport.session())
       -----------------------------------------------------------
       Passport session support depends on Express session.

       This is THE critical ordering:
         session() first
         passport.initialize() second
         passport.session() third

       Cookie strategy:
       - sameSite "lax" is fine for same-site scenarios.
       - sameSite "none" is required for cross-origin cookies.
       - sameSite "none" ALSO requires secure: true (HTTPS).
       =========================================================== */
    const sessionSecret = process.env.SESSION_SECRET;
    if (!sessionSecret && !isTest) {
        throw new Error("SESSION_SECRET is not set");
    }

    // ✅ If your UI + API are truly cross-origin in prod, keep "none".
    // ✅ If they are same-origin in prod (UI and API on same host), use "lax".
    //
    // Most common setup:
    // - Dev: UI localhost:5173, API localhost:3001 -> cross-origin -> lax is OK
    // - Prod: UI domain, API subdomain -> cross-origin -> none is needed
    const cookieSameSite = "lax";

    app.use(
        session({
            name: "hpl.sid",
            secret: sessionSecret ?? "test-secret", // tests only
            resave: false,
            saveUninitialized: false,

            // ✅ Cloudflare / reverse proxy friendly
            proxy: true,

            cookie: {
                httpOnly: true,

                // ✅ must be true when sameSite is "none"
                secure: isProd,

                sameSite: "none",

                // ✅ allow cookie across root + api subdomain (prod only)
                domain: isProd ? ".thehumanpatternlab.com" : undefined,

                // Optional: makes sessions survive restarts for a bit
                // maxAge: 1000 * 60 * 60 * 24 * 7,
            },
        })
    );

    /* ===========================================================
       10) PASSPORT MIDDLEWARE (AFTER SESSION)
       -----------------------------------------------------------
       - initialize() sets up passport on req/res
       - session() reads/writes req.user from the session cookie
       =========================================================== */
    app.use(passport.initialize());
    app.use(passport.session());

    /* ===========================================================
       11) DEBUG ENDPOINT (TEMPORARY BUT GOLD)
       -----------------------------------------------------------
       Use this to detect auth loops instantly.
       - hasCookieHeader false -> cookie not stored/sent (CORS/sameSite/secure/origin)
       - sessionID changes every refresh -> cookie not sticking
       - hasCookieHeader true but isAuthenticated false -> passport deserialize problem
       =========================================================== */
    app.get("/auth/debug", (req, res) => {
        res.json({
            origin: req.headers.origin ?? null,
            hasCookieHeader: Boolean(req.headers.cookie),
            sessionID: req.sessionID,
            isAuthenticated: req.isAuthenticated?.() ?? false,
            user: req.user ?? null,
        });
    });

    /* ===========================================================
       12) ROUTES (LAST)
       -----------------------------------------------------------
       Now req.user is available to route handlers and guards.
       =========================================================== */
    const api = express.Router();

// Register ALL API routes on the router
    registerHealthRoutes(api, dbPath);
    registerAdminRoutes(api, db);
    registerLabNotesRoutes(api, db);

// MOUNT THE ROUTER (this is what makes routes actually exist)
    app.use("/", api);     // ✅ canonical

// Non-API routes can still live at root if you want:
    registerOpenApiRoutes(app);
    return app;
}
