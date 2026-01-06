import crypto from "crypto";
import type Database from "better-sqlite3";

export type ApiTokenRecord = {
    id: string;
    label: string;
    scopes: string[];
    is_active: 0 | 1;
    expires_at: string | null;
    created_by_user: string | null;
    last_used_at: string | null;
    created_at: string;
};

function nowIso(): string {
    return new Date().toISOString();
}

// base64url without padding
function base64Url(buf: Buffer): string {
    return buf
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}

// ⚠️ Pepper must be set in production
function tokenPepper(): string {
    const p = process.env.TOKEN_PEPPER;
    if (!p || !p.trim()) {
        // Fail closed in production. In dev you can allow missing if you want.
        if (process.env.NODE_ENV === "production") {
            throw new Error("TOKEN_PEPPER is not set");
        }
        return "dev-pepper";
    }
    return p;
}

export function hashToken(rawToken: string): string {
    const pepper = tokenPepper();
    return crypto.createHash("sha256").update(`${pepper}:${rawToken}`, "utf8").digest("hex");
}

export function generateRawToken(): string {
    // 32 bytes = 256 bits of entropy
    const rand = base64Url(crypto.randomBytes(32));
    const prefix = process.env.NODE_ENV === "production" ? "hpl_live_" : "hpl_test_";
    return `${prefix}${rand}`;
}

export function mintApiToken(
    db: Database.Database,
    input: {
        label: string;
        scopes: string[];
        expires_at?: string | null;
        created_by_user?: string | null;
    }
): { token: string; id: string } {
    const id = crypto.randomUUID();
    const token = generateRawToken();
    const token_hash = hashToken(token);

    db.prepare(`
    INSERT INTO api_tokens (
      id, label, token_hash, scopes_json, is_active, expires_at, created_by_user, created_at
    )
    VALUES (?, ?, ?, ?, 1, ?, ?, ?)
  `).run(
        id,
        input.label,
        token_hash,
        JSON.stringify(input.scopes ?? []),
        input.expires_at ?? null,
        input.created_by_user ?? null,
        nowIso()
    );

    // Return raw token ONCE (never store raw)
    return { token, id };
}

export function verifyApiToken(
    db: Database.Database,
    rawToken: string
): { token: ApiTokenRecord; scopes: string[] } | null {
    const token_hash = hashToken(rawToken);

    const row = db.prepare(`
    SELECT id, label, scopes_json, is_active, expires_at, created_by_user, last_used_at, created_at
    FROM api_tokens
    WHERE token_hash = ?
    LIMIT 1
  `).get(token_hash) as any | undefined;

    if (!row) return null;
    if (row.is_active !== 1) return null;

    if (row.expires_at) {
        const exp = Date.parse(row.expires_at);
        if (Number.isFinite(exp) && exp <= Date.now()) return null;
    }

    const scopes = safeParseJsonArray(row.scopes_json);

    // Touch last_used_at (cheap audit)
    db.prepare(`UPDATE api_tokens SET last_used_at = ? WHERE id = ?`).run(nowIso(), row.id);

    return {
        token: {
            id: row.id,
            label: row.label,
            scopes,
            is_active: row.is_active,
            expires_at: row.expires_at ?? null,
            created_by_user: row.created_by_user ?? null,
            last_used_at: row.last_used_at ?? null,
            created_at: row.created_at,
        },
        scopes,
    };
}

function safeParseJsonArray(input: any): string[] {
    if (!input || typeof input !== "string") return [];
    try {
        const v = JSON.parse(input);
        if (Array.isArray(v)) return v.filter((x) => typeof x === "string");
        return [];
    } catch {
        return [];
    }
}
