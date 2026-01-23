// src/routes/labNotesRoutes.ts
import type { Request, Response } from "express";
import type Database from "better-sqlite3";
import type { LabNoteRecord, TagResult } from "../types/labNotes.js";
import { mapToLabNotePreview, mapToLabNoteView } from "../mappers/labNotesMapper.js";
import { normalizeLocale, inferLocale } from "../lib/helpers.js";
import { expandMascotBlocks } from "../lib/markdownBlocks.js";
import { marked } from "marked";

marked.setOptions({
    gfm: true,
    breaks: false, // ✅ strict
});

export function registerLabNotesRoutes(app: any, db: Database.Database) {
    // ---------------------------------------------------------------------------
    // Public: Lab Notes list (preview) — PUBLISHED ONLY, PREVIEW FIELDS ONLY
    // ---------------------------------------------------------------------------
    app.get("/lab-notes", (req: Request, res: Response) => {
        try {
            const locale = normalizeLocale(req.query.locale);

            const orderBy = `
        ORDER BY
          published_at DESC,
          updated_at DESC
      `;

            const sqlAll = `
                SELECT
                    id, slug, locale, type, status,
                    title, subtitle, summary, excerpt,
                    department_id, dept, shadow_density, safer_landing, read_time_minutes,
                    published_at, created_at, updated_at, card_style
                FROM v_lab_notes
                WHERE status = 'published'
                    ${orderBy}
            `;

            const sqlByLocale = `
                SELECT
                    id, slug, locale, type, status,
                    title, subtitle, summary, excerpt,
                    department_id, dept, shadow_density, safer_landing, read_time_minutes,
                    published_at, created_at, updated_at, card_style
                FROM v_lab_notes
                WHERE locale = ?
                  AND status = 'published'
                    ${orderBy}
            `;

            const notes = (locale === "all"
                ? db.prepare(sqlAll).all()
                : db.prepare(sqlByLocale).all(locale)) as LabNoteRecord[];

            const mapped = notes.map((note) => {
                const tagRows = db
                    .prepare("SELECT tag FROM lab_note_tags WHERE note_id = ?")
                    .all(note.id) as TagResult[];

                return mapToLabNotePreview(note, tagRows.map((t) => t.tag));
            });

            return res.json(mapped);
        } catch (e: any) {
            console.error("GET /lab-notes failed:", e?.message);
            if (res.headersSent) return;
            return res.status(500).json({ error: e?.message ?? "unknown" });
        }
    });

    // ---------------------------------------------------------------------------
    // Public: single Lab Note (detail) — PUBLISHED ONLY, (slug, locale) identity
    // Renders markdown from ledger-backed content_markdown via v_lab_notes.
    // ---------------------------------------------------------------------------
    app.get("/lab-notes/:slug", (req: Request, res: Response) => {
        try {
            const slug = String(req.params.slug ?? "").trim();
            const locale = inferLocale(req);

            if (!slug) return res.status(400).json({ error: "slug is required" });

            const sql = `
                SELECT
                    id, slug, locale, type, status,
                    title, subtitle, summary, excerpt, category,
                    department_id, dept, shadow_density, coherence_score,
                    safer_landing, read_time_minutes,
                    published_at, created_at, updated_at, card_style,
                    content_markdown
                FROM v_lab_notes
                WHERE slug = ?
                  AND locale = ?
                  AND status = 'published'
                LIMIT 1
            `;

            // 1) canonical lookup: slug + locale column
            let row = db.prepare(sql).get(slug, locale) as
                | (LabNoteRecord & { content_markdown?: string })
                | undefined;

            // 2) legacy fallback: slug stored as "slug:locale"
            if (!row) {
                row = db.prepare(sql).get(`${slug}:${locale}`, locale) as
                    | (LabNoteRecord & { content_markdown?: string })
                    | undefined;
            }

            // 3) extra back-compat: if caller passed "slug:xx", split and try
            if (!row && slug.includes(":")) {
                const [baseSlug, maybeLocale] = slug.split(":", 2);
                const inferred = normalizeLocale(maybeLocale);
                const effectiveLocale = inferred && inferred !== "all" ? inferred : locale;

                row = db.prepare(sql).get(baseSlug, effectiveLocale) as
                    | (LabNoteRecord & { content_markdown?: string })
                    | undefined;

                if (!row) {
                    row = db.prepare(sql).get(`${baseSlug}:${effectiveLocale}`, effectiveLocale) as
                        | (LabNoteRecord & { content_markdown?: string })
                        | undefined;
                }
            }

            if (!row) return res.status(404).json({ error: "Not found" });

            const tagRows = db
                .prepare("SELECT tag FROM lab_note_tags WHERE note_id = ?")
                .all(row.id) as TagResult[];

            const markdown = String(row.content_markdown ?? "");
            const expanded = expandMascotBlocks(markdown);
            const html = marked.parse(expanded) as string;

            const noteForMapper = {
                ...(row as any),
                content_html: html,
            } as LabNoteRecord;

            const mapped = mapToLabNoteView(noteForMapper, tagRows.map((t) => t.tag));

            return res.json({
                ...mapped,
                // ✅ canonical truth for “correct” clients
                content_markdown: markdown,
            });
        } catch (e: any) {
            console.error("GET /lab-notes/:slug failed:", e?.message);
            if (res.headersSent) return;
            return res.status(500).json({ error: e?.message ?? "unknown" });
        }
    });

    // ---------------------------------------------------------------------------
    // Public Upsert — DISABLED
    // This endpoint wrote v1 wide-row content_html directly, which desyncs the ledger.
    // When re-enabled, it must write a new lab_note_revisions row + update pointers.
    // ---------------------------------------------------------------------------
    app.post("/lab-notes/upsert", (_req: Request, res: Response) => {
        return res.status(503).json({
            error: "Upsert disabled (ledger-only). Use admin endpoints / revision writes instead.",
        });
    });
}
