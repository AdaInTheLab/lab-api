// src/env.ts
import dotenv from "dotenv";

/* ===========================================================
   🌱 HUMAN PATTERN LAB — ENV LOADER + VALIDATOR (Zod-style)
   =========================================================== */

type NodeEnv = "development" | "test" | "production";

type Env = {
    NODE_ENV: NodeEnv;
    PORT: number;
    DB_PATH: string; // optional override; db.ts decides defaults
    SESSION_SECRET?: string;
};

class EnvError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "EnvError";
    }
}

// ── Load dotenv as early as possible ──────────────────────
const rawNodeEnv = process.env.NODE_ENV ?? "development";
if (rawNodeEnv !== "test") {
    dotenv.config();
}

// ── Normalizers ───────────────────────────────────────────
function normalizeNodeEnv(value: string): NodeEnv {
    const v = value === "dev" ? "development" : value === "prod" ? "production" : value;

    if (v === "development" || v === "test" || v === "production") return v;
    throw new EnvError(`Invalid NODE_ENV="${value}". Use "development", "test", or "production".`);
}

function parsePort(value: string | undefined, fallback: number): number {
    if (value == null || value.trim() === "") return fallback;
    const n = Number(value);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0 || n > 65535) {
        throw new EnvError(`Invalid PORT="${value}". Must be an integer from 1-65535.`);
    }
    return n;
}

// ── Validator (Zod-style) ─────────────────────────────────
function validateEnv(input: NodeJS.ProcessEnv): Env {
    const NODE_ENV = normalizeNodeEnv(input.NODE_ENV ?? "development");
    const PORT = parsePort(input.PORT, 8001);

    const DB_PATH = (input.DB_PATH ?? "").trim();

    // Safety rule: tests must never point at a file DB
    if (NODE_ENV === "test" && DB_PATH !== "" && DB_PATH !== ":memory:") {
        throw new EnvError(
            `Refusing NODE_ENV=test with DB_PATH="${DB_PATH}". Use DB_PATH=":memory:" or unset DB_PATH.`
        );
    }

    // Optional: gently discourage missing secret in production
    const SESSION_SECRET = input.SESSION_SECRET?.trim();
    if (NODE_ENV === "production" && (!SESSION_SECRET || SESSION_SECRET.length < 16)) {
        // throw if you want strict; warn if you want lenient
        console.warn("⚠️ SESSION_SECRET is missing/short in production. Set a strong secret.");
    }

    return {
        NODE_ENV,
        PORT,
        DB_PATH,
        SESSION_SECRET,
    };
}

export const env = validateEnv(process.env);
