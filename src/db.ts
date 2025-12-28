// src/db.ts
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "./env.js";

export function resolveDbPath(): string {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    // Default DB file paths (only used when NOT in test, and DB_PATH not provided)
    const defaultDbFile =
        env.NODE_ENV === "development"
            ? path.join(__dirname, "../data/lab.dev.db")
            : path.join(__dirname, "../data/lab.db");

    const dbPath =
        env.NODE_ENV === "test"
            ? ":memory:"
            : env.DB_PATH
                ? path.resolve(env.DB_PATH)
                : defaultDbFile;

    // Guardrail: tests must NEVER hit a file DB
    if (env.NODE_ENV === "test" && dbPath !== ":memory:") {
        throw new Error(`Refusing to run tests on file DB: ${dbPath}`);
    }

    return dbPath;
}

export function openDb(dbPath: string) {
    const verbose = process.env.DB_VERBOSE === "1" ? console.log : undefined;
    return new Database(dbPath, { verbose });
}

export function bootstrapDb(db: Database.Database) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS lab_notes (
                                                 id TEXT PRIMARY KEY,
                                                 title TEXT NOT NULL,
                                                 slug TEXT UNIQUE NOT NULL,
                                                 category TEXT,
                                                 excerpt TEXT,
                                                 content_html TEXT,
                                                 content_md TEXT,
                                                 department_id TEXT DEFAULT 'SCMS',
                                                 shadow_density INTEGER DEFAULT 0,
                                                 coherence_score REAL DEFAULT 1.0,
                                                 safer_landing BOOLEAN DEFAULT 0,
                                                 read_time_minutes INTEGER,
                                                 published_at TEXT,
                                                 created_at TEXT,
                                                 updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS lab_note_tags (
                                                     id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                     note_id TEXT NOT NULL,
                                                     tag TEXT NOT NULL,
                                                     UNIQUE(note_id, tag),
                                                     FOREIGN KEY (note_id) REFERENCES lab_notes(id) ON DELETE CASCADE
        );

        DROP VIEW IF EXISTS v_lab_notes;
        CREATE VIEW v_lab_notes AS
        SELECT * FROM lab_notes;
    `);
}

export function seedMarkerNote(db: Database.Database) {
    db.prepare(`
        INSERT OR IGNORE INTO lab_notes (
            id,
            title,
            slug,
            category,
            excerpt,
            department_id,
            published_at,
            created_at,
            updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        "api-marker",
        "API Marker Note",
        "api-marker-note",
        "Debug",
        "If you can see this in WebStorm, we are looking at the same DB.",
        "SCMS",
        new Date().toISOString().slice(0, 10),
        new Date().toISOString(),
        new Date().toISOString()
    );
}

export function isDbEmpty(db: Database.Database): boolean {
    const row = db.prepare(`SELECT COUNT(*) as count FROM lab_notes`).get() as { count: number };
    return row.count === 0;
}
