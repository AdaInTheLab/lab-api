// src/env.ts
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

/* ===========================================================
   🌱 HUMAN PATTERN LAB — ENV LOADER + VALIDATOR
   =========================================================== */

type NodeEnv = "development" | "test" | "production";

type Env = {
    NODE_ENV: NodeEnv;
    PORT: number;
    DB_PATH: string;
    SESSION_SECRET?: string;

    UI_BASE_URL?: string;

    // optional OAuth vars (used by auth.ts via process.env)
    OAUTH_GITHUB_CLIENT_ID?: string;
    OAUTH_GITHUB_CLIENT_SECRET?: string;
    OAUTH_GITHUB_CALLBACK_URL?: string;

    ALLOWED_GITHUB_USERNAME?: string;
    DB_SEED?: string;
    DB_MIGRATE_VERBOSE?: string;
};

class EnvError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "EnvError";
    }
}

// ── Load dotenv early ───────────────────────────────────────
const rawNodeEnv = process.env.NODE_ENV ?? "development";

if (rawNodeEnv !== "test") {
    // Load base .env
    dotenv.config({ path: ".env" });

    // Load env-specific file (override base)
    const envFile = `.env.${rawNodeEnv}`;
    const envPath = path.join(process.cwd(), envFile);
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envFile, override: true });
    }
}

// ── Normalizers ────────────────────────────────────────────
function normalizeNodeEnv(value: string): NodeEnv {
    const v = value === "dev" ? "development" : value === "prod" ? "production" : value;
    if (v === "development" || v === "test" || v === "production") return v;
    throw new EnvError('Invalid NODE_ENV="' + value + '". Use "development", "test", or "production".');
}

function parsePort(value: string | undefined, fallback: number): number {
    if (value == null || value.trim() === "") return fallback;
    const n = Number(value);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0 || n > 65535) {
        throw new EnvError('Invalid PORT="' + value + '". Must be an integer from 1-65535.');
    }
    return n;
}

// ── Validator ──────────────────────────────────────────────
function validateEnv(input: NodeJS.ProcessEnv): Env {
    const NODE_ENV = normalizeNodeEnv(input.NODE_ENV ?? "development");
    const PORT = parsePort(input.PORT, 8001);

    const DB_PATH = (input.DB_PATH ?? "").trim();

    if (NODE_ENV === "test" && DB_PATH !== "" && DB_PATH !== ":memory:") {
        throw new EnvError(
            'Refusing NODE_ENV=test with DB_PATH="' + DB_PATH + '". Use DB_PATH=":memory:" or unset DB_PATH.'
        );
    }

    const SESSION_SECRET = input.SESSION_SECRET?.trim();
    if (NODE_ENV === "production" && (!SESSION_SECRET || SESSION_SECRET.length < 16)) {
        console.warn("⚠️ SESSION_SECRET is missing/short in production. Set a strong secret.");
    }

    return {
        NODE_ENV,
        PORT,
        DB_PATH,
        SESSION_SECRET,

        UI_BASE_URL: input.UI_BASE_URL?.trim(),

        OAUTH_GITHUB_CLIENT_ID: input.OAUTH_GITHUB_CLIENT_ID?.trim(),
        OAUTH_GITHUB_CLIENT_SECRET: input.OAUTH_GITHUB_CLIENT_SECRET?.trim(),
        OAUTH_GITHUB_CALLBACK_URL: input.OAUTH_GITHUB_CALLBACK_URL?.trim(),

        ALLOWED_GITHUB_USERNAME: input.ALLOWED_GITHUB_USERNAME?.trim(),
        DB_SEED: input.DB_SEED?.trim(),
        DB_MIGRATE_VERBOSE: input.DB_MIGRATE_VERBOSE?.trim(),
    };
}

export const env = validateEnv(process.env);
