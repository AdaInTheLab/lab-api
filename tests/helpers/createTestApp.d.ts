import type { Express } from "express";
import type Database from "better-sqlite3";
import { openDb, bootstrapDb, seedMarkerNote } from "../../src/db.js";

export function api(path: string): string;
export function createTestApp(): {
    app: Express;
    db: Database.Database;
};
