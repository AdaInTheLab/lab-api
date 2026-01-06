// tests/requireAdmin.http.test.ts
import {generateRawToken, hashToken, mintApiToken, verifyApiToken} from "../src/auth/tokens.js";
import Database from "better-sqlite3";

function createDb() {
    const db = new Database(":memory:");
    db.exec(`
        CREATE TABLE api_tokens (
                                    id TEXT PRIMARY KEY,
                                    label TEXT NOT NULL,
                                    token_hash TEXT NOT NULL,
                                    scopes_json TEXT NOT NULL DEFAULT '[]',
                                    is_active INTEGER NOT NULL DEFAULT 1,
                                    expires_at TEXT NULL,
                                    created_by_user TEXT NULL,
                                    last_used_at TEXT NULL,
                                    created_at TEXT NOT NULL
        );
        CREATE UNIQUE INDEX uq_api_tokens_hash ON api_tokens(token_hash);
    `);
    return db;
}

describe("auth/tokens", () => {
    const prevEnv = process.env;

    beforeEach(() => {
        process.env = { ...prevEnv };
        process.env.NODE_ENV = "test";
        process.env.TOKEN_PEPPER = "unit-test-pepper";
    });

    afterEach(() => {
        process.env = prevEnv;
    });

    test("hashToken is stable for same input (with pepper)", () => {
        const h1 = hashToken("hpl_test_abc");
        const h2 = hashToken("hpl_test_abc");
        expect(h1).toBe(h2);
    });

    test("generateRawToken uses test prefix outside production", () => {
        process.env.NODE_ENV = "test";
        const t = generateRawToken();
        expect(t.startsWith("hpl_test_")).toBe(true);
    });

    test("generateRawToken uses live prefix in production", () => {
        process.env.NODE_ENV = "production";
        process.env.TOKEN_PEPPER = "prod-pepper";
        const t = generateRawToken();
        expect(t.startsWith("hpl_live_")).toBe(true);
    });

    test("tokenPepper fails closed in production when missing", () => {
        process.env.NODE_ENV = "production";
        delete process.env.TOKEN_PEPPER;
        expect(() => hashToken("hpl_live_x")).toThrow(/TOKEN_PEPPER is not set/i);
    });

    test("mintApiToken inserts row and returns raw token once", () => {
        const db = createDb();

        const { token, id } = mintApiToken(db, {
            label: "CI",
            scopes: ["notes:write", "notes:publish"],
            created_by_user: "ada",
        });

        expect(typeof token).toBe("string");
        expect(typeof id).toBe("string");
        expect(token.startsWith("hpl_test_")).toBe(true);

        const row = db
            .prepare(
                "SELECT id, label, token_hash, scopes_json, is_active FROM api_tokens WHERE id = ?"
            )
            .get(id) as any;

        expect(row).toBeTruthy();
        expect(row.label).toBe("CI");
        expect(row.is_active).toBe(1);
        expect(row.token_hash).toBe(hashToken(token));
        expect(JSON.parse(row.scopes_json)).toEqual(["notes:write", "notes:publish"]);
    });

    test("verifyApiToken returns null for unknown token", () => {
        const db = createDb();
        const out = verifyApiToken(db, "hpl_test_not_real");
        expect(out).toBeNull();
    });

    test("verifyApiToken returns null for inactive token", () => {
        const db = createDb();

        const { token, id } = mintApiToken(db, { label: "Inactive", scopes: [] });
        db.prepare("UPDATE api_tokens SET is_active = 0 WHERE id = ?").run(id);

        const out = verifyApiToken(db, token);
        expect(out).toBeNull();
    });

    test("verifyApiToken returns null for expired token", () => {
        const db = createDb();

        const { token, id } = mintApiToken(db, { label: "Expired", scopes: [] });
        db.prepare("UPDATE api_tokens SET expires_at = ? WHERE id = ?").run(
            "2000-01-01T00:00:00.000Z",
            id
        );

        const out = verifyApiToken(db, token);
        expect(out).toBeNull();
    });

    test("verifyApiToken returns scopes and touches last_used_at", () => {
        const db = createDb();

        const { token, id } = mintApiToken(db, {
            label: "Agent",
            scopes: ["notes:read"],
        });

        const before = db
            .prepare("SELECT last_used_at FROM api_tokens WHERE id = ?")
            .get(id) as any;

        expect(before.last_used_at).toBeNull();

        const out = verifyApiToken(db, token);
        expect(out).not.toBeNull();
        expect(out?.token.id).toBe(id);
        expect(out?.scopes).toEqual(["notes:read"]);

        const after = db
            .prepare("SELECT last_used_at FROM api_tokens WHERE id = ?")
            .get(id) as any;

        expect(after.last_used_at).toBeTruthy();
        expect(Number.isFinite(Date.parse(after.last_used_at))).toBe(true);
    });

    test("verifyApiToken safely handles malformed scopes_json", () => {
        const db = createDb();

        const { token, id } = mintApiToken(db, { label: "Weird", scopes: ["ok"] });
        db.prepare("UPDATE api_tokens SET scopes_json = ? WHERE id = ?").run("not-json", id);

        const out = verifyApiToken(db, token);
        expect(out).not.toBeNull();
        expect(out?.scopes).toEqual([]);
    });
});
