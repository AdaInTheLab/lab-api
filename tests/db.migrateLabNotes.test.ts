import Database from "better-sqlite3";
import { migrateLabNotesSchema } from "../src/db/migrateLabNotes.js";

function openMemoryDb() {
    return new Database(":memory:");
}

function tableExists(db: Database.Database, name: string) {
    const row = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
        .get(name) as { name?: string } | undefined;
    return !!row?.name;
}

function viewExists(db: Database.Database, name: string) {
    const row = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='view' AND name=?`)
        .get(name) as { name?: string } | undefined;
    return !!row?.name;
}

function getCols(db: Database.Database, table: string): string[] {
    return db.prepare(`PRAGMA table_info(${table})`).all().map((r: any) => r.name);
}

function getSchemaVersion(db: Database.Database): number {
    const row = db
        .prepare(`SELECT value FROM schema_meta WHERE key='lab_notes_schema_version'`)
        .get() as { value?: string } | undefined;
    return row?.value ? Number(row.value) : 0;
}

describe("migrateLabNotesSchema", () => {
    test("fresh DB: creates schema, view, tag table, and sets schema version", () => {
        const db = openMemoryDb();

        const logs: string[] = [];
        const res = migrateLabNotesSchema(db, (m) => logs.push(m));

        expect(tableExists(db, "lab_notes")).toBe(true);
        expect(viewExists(db, "v_lab_notes")).toBe(true);
        expect(tableExists(db, "schema_meta")).toBe(true);
        expect(tableExists(db, "lab_note_tags")).toBe(true);

        // a couple key columns should exist
        const cols = getCols(db, "lab_notes");
        expect(cols).toContain("translation_status");
        expect(cols).toContain("department_id");

        // version should be set
        expect(getSchemaVersion(db)).toBeGreaterThan(0);

        // should have logged something on a fresh DB
        expect(res.createdFreshTable).toBe(true);
        expect(logs.length).toBeGreaterThan(0);

        db.close();
    });

    test("existing minimal lab_notes table: adds missing columns and preserves rows + backfills group_id", () => {
        const db = openMemoryDb();

        // simulate an old DB that only had id
        db.exec(`
      CREATE TABLE lab_notes (id TEXT PRIMARY KEY);
      INSERT INTO lab_notes (id) VALUES ('n1');
    `);

        const res = migrateLabNotesSchema(db);

        // row preserved
        const row = db.prepare(`SELECT id, group_id FROM lab_notes WHERE id='n1'`).get() as any;
        expect(row.id).toBe("n1");
        expect(row.group_id).toBe("n1"); // backfilled

        // should have added columns
        expect(res.addedColumns.length).toBeGreaterThan(0);

        db.close();
    });

    test("idempotent: second run adds no columns and does not throw", () => {
        const db = openMemoryDb();

        const first = migrateLabNotesSchema(db);
        const second = migrateLabNotesSchema(db);

        expect(first.createdFreshTable).toBe(true);
        expect(second.createdFreshTable).toBe(false);
        expect(second.addedColumns).toEqual([]);

        db.close();
    });

    test("logger: logs only when changes occur", () => {
        const db = openMemoryDb();

        const logs1: string[] = [];
        migrateLabNotesSchema(db, (m) => logs1.push(m));
        expect(logs1.length).toBeGreaterThan(0);

        const logs2: string[] = [];
        migrateLabNotesSchema(db, (m) => logs2.push(m));
        expect(logs2.length).toBe(0);

        db.close();
    });
});
