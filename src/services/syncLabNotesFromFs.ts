// src/services/syncLabNotesFromFs.ts
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import type Database from "better-sqlite3";

type SyncCounts = {
    rootDir: string;
    locales: string[];
    scanned: number;
    upserted: number;
    skipped: number;
    errors: Array<{ file: string; error: string }>;
};

function listMarkdownFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir)
        .filter((f) => f.toLowerCase().endsWith(".md"))
        .map((f) => path.join(dir, f));
}

function slugFromFilename(filePath: string): string {
    return path.basename(filePath, path.extname(filePath));
}

export function syncLabNotesFromFs(db: Database.Database): SyncCounts {
    const rootDir = String(process.env.LABNOTES_DIR || "").trim();
    if (!rootDir) {
        throw new Error("LABNOTES_DIR is not set");
    }
    if (!fs.existsSync(rootDir)) {
        throw new Error(`LABNOTES_DIR not found: ${rootDir}`);
    }

    const localeDirs = fs
        .readdirSync(rootDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

    // Fallback: if root contains .md directly, treat as "en"
    const rootMd = listMarkdownFiles(rootDir);
    const locales = localeDirs.length ? localeDirs : ["en"];

    const counts: SyncCounts = {
        rootDir,
        locales,
        scanned: 0,
        upserted: 0,
        skipped: 0,
        errors: [],
    };

    const upsert = db.prepare(`
    INSERT INTO lab_notes (
      id, slug, title, excerpt, content_html, locale,
      category, department_id,
      shadow_density, coherence_score, safer_landing, read_time_minutes,
      published_at
    )
    VALUES (
      coalesce(?, lower(hex(randomblob(16)))),
      ?, ?, ?, ?, ?,
      ?, ?,
      ?, ?, ?, ?,
      ?
    )
    ON CONFLICT(slug, locale) DO UPDATE SET
      title=excluded.title,
      excerpt=excluded.excerpt,
      content_html=excluded.content_html,
      category=excluded.category,
      department_id=excluded.department_id,
      shadow_density=excluded.shadow_density,
      coherence_score=excluded.coherence_score,
      safer_landing=excluded.safer_landing,
      read_time_minutes=excluded.read_time_minutes,
      published_at=excluded.published_at,
      updated_at=CURRENT_TIMESTAMP
  `);

    const selectExisting = db.prepare(`
    SELECT content_html, title, excerpt, category, department_id
    FROM lab_notes
    WHERE slug = ? AND locale = ?
    LIMIT 1
  `);

    const processFile = (filePath: string, locale: string) => {
        counts.scanned += 1;

        try {
            const raw = fs.readFileSync(filePath, "utf8");
            const parsed = matter(raw);

            const slug = String(parsed.data.slug || slugFromFilename(filePath)).trim();
            const title = String(parsed.data.title || slug).trim();

            const excerpt = String(parsed.data.excerpt || "").trim();
            const category = parsed.data.category ? String(parsed.data.category) : null;
            const departmentId = parsed.data.department_id ? String(parsed.data.department_id) : null;

            const shadowDensity = parsed.data.shadow_density ?? null;
            const coherenceScore = parsed.data.coherence_score ?? null;
            const saferLanding = parsed.data.safer_landing ?? null;
            const readTimeMinutes = parsed.data.read_time_minutes ?? null;
            const publishedAt = parsed.data.published_at ? String(parsed.data.published_at) : null;

            const contentHtml = marked.parse(String(parsed.content || ""));

            // Skip if nothing meaningfully changed (basic check)
            const existing = selectExisting.get(slug, locale) as any;
            if (
                existing &&
                existing.content_html === contentHtml &&
                existing.title === title &&
                existing.excerpt === excerpt &&
                (existing.category ?? null) === (category ?? null) &&
                (existing.department_id ?? null) === (departmentId ?? null)
            ) {
                counts.skipped += 1;
                return;
            }

            upsert.run(
                null, // id (optional)
                slug,
                title,
                excerpt || null,
                contentHtml,
                locale,
                category,
                departmentId,
                shadowDensity,
                coherenceScore,
                saferLanding,
                readTimeMinutes,
                publishedAt
            );

            counts.upserted += 1;
        } catch (e: any) {
            counts.errors.push({ file: filePath, error: e?.message ?? String(e) });
        }
    };

    if (localeDirs.length) {
        for (const loc of localeDirs) {
            const files = listMarkdownFiles(path.join(rootDir, loc));
            for (const f of files) processFile(f, loc);
        }
    } else {
        for (const f of rootMd) processFile(f, "en");
    }

    return counts;
}
