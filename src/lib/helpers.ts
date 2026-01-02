// lib/helpers.ts

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