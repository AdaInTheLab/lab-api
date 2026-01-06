// lib/helpers.ts
import crypto from "crypto";

export function normalizeLocale(input: unknown) {
    const raw = String(input ?? "en").trim().toLowerCase();
    if (!raw) return "en";

    // Handle common variants: en-US, en_US, en-us -> en
    const two = raw.split(/[-_]/)[0];
    if (two === "en" || two === "ko") return two;

    // Fallback: keep first two letters if present
    if (two.length >= 2) return two.slice(0, 2);

    return "en";
}

export function sha256Hex(input: string): string {
    return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}