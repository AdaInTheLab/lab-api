// src/seed/devSeed.ts
import Database from "better-sqlite3";

// Keep this small + safe: only runs in development AND only if db is empty
// src/seed/devSeed.js
export function seedDevDb(_db) {
    // no-op in tests unless you explicitly allow it
}