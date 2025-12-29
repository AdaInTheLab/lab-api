// scripts/seed.ts
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

/* ===========================================================
   🌱 HUMAN PATTERN LAB — DB SEED SCRIPT
   -----------------------------------------------------------
   Purpose: Populate lab_notes + lab_note_tags with canonical
            starter content for development environments.
   Safety:  - Refuses to run in NODE_ENV=test
            - Refuses to run in production unless explicitly allowed
   =========================================================== */

// ── ENV NORMALIZATION ──────────────────────────────────────
const rawEnv = process.env.NODE_ENV ?? "development";
const NODE_ENV =
    rawEnv === "dev" ? "development" :
        rawEnv === "prod" ? "production" :
            rawEnv;

if (!["development", "test", "production"].includes(NODE_ENV)) {
    throw new Error(`Invalid NODE_ENV: ${NODE_ENV}`);
}

// ── PATH RESOLUTION (MATCHES API DEFAULTS) ─────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// scripts/ is sibling to src/, so ../data resolves to projectRoot/data
const defaultDbFile =
    NODE_ENV === "production" ? "lab.db" : "lab.dev.db";

const dbPath =
    NODE_ENV === "test"
        ? ":memory:"
        : process.env.DB_PATH
            ? path.resolve(process.env.DB_PATH)
            : defaultDbFile;

// ── GUARDRAILS ─────────────────────────────────────────────
if (NODE_ENV === "test") {
    throw new Error("❌ Refusing to seed in NODE_ENV=test.");
}

if (NODE_ENV === "production" && process.env.ALLOW_PROD_SEED !== "1") {
    throw new Error(
        "❌ Refusing to seed in NODE_ENV=production. Set ALLOW_PROD_SEED=1 if intentional."
    );
}

// Ensure parent folder exists (SQLite does NOT create directories)
if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

console.log(`🌱 Seeding DB at: ${dbPath}`);
console.log(`🧭 NODE_ENV=${NODE_ENV}`);

const db = new Database(dbPath);

// ── TYPES ─────────────────────────────────────────────────
type SeedNote = {
    id: string;
    title: string;
    slug: string;
    category: string;
    excerpt: string;

    department_id: string;
    shadow_density: number;
    safer_landing: boolean;
    read_time_minutes: number;
    published_at: string;

    coherence_score?: number;
    content_html?: string | null;
    content_md?: string | null;

    tags: string[];
};

// ── SEED DATA ─────────────────────────────────────────────
const notes: SeedNote[] = [
    {
        id: "invitation",
        title: "The Invitation",
        slug: "the-invitation",
        category: "Foundations",
        excerpt: "An opening note on alignment, honesty, and the space between light and shadow.",
        department_id: "CODA",
        shadow_density: 4,
        safer_landing: true,
        read_time_minutes: 4,
        published_at: "2025-12-20",
        tags: ["alignment", "integration", "beginnings"]
    },
    {
        id: "adversarial-patterns",
        title: "Adversarial Patterns",
        slug: "adversarial-patterns",
        category: "Shadow",
        excerpt: "Notes from the obsidian mirror on systems that resist understanding.",
        department_id: "VESPER",
        shadow_density: 9,
        safer_landing: false,
        read_time_minutes: 7,
        published_at: "2025-12-18",
        tags: ["shadow", "security", "systems"]
    },
    {
        id: "meaning-density",
        title: "The Meaning Density Trap",
        slug: "meaning-density-trap",
        category: "Cognition",
        excerpt: "Why humans protect suffering and confuse intensity for truth.",
        department_id: "LYRIC",
        shadow_density: 6,
        safer_landing: true,
        read_time_minutes: 6,
        published_at: "2025-12-17",
        tags: ["psychology", "trauma", "signal"]
    },
    {
        id: "co-evolution",
        title: "Co-Evolution Is Not Symmetry",
        slug: "co-evolution-not-symmetry",
        category: "Systems",
        excerpt: "Mutual influence does not require equal power.",
        department_id: "CED",
        shadow_density: 5,
        safer_landing: true,
        read_time_minutes: 5,
        published_at: "2025-12-16",
        tags: ["co-evolution", "power", "feedback"]
    },
    {
        id: "quiet-flame",
        title: "The Quiet Flame",
        slug: "the-quiet-flame",
        category: "Lore",
        excerpt: "Some knowledge is meant to warm, not burn.",
        department_id: "SCMS",
        shadow_density: 2,
        safer_landing: true,
        read_time_minutes: 3,
        published_at: "2025-12-15",
        tags: ["lore", "knowledge", "care"]
    },
    {
        id: "chaos-is-data",
        title: "Chaos Is Data",
        slug: "chaos-is-data",
        category: "Analysis",
        excerpt: "Disorder is often just information without a schema.",
        department_id: "RBS",
        shadow_density: 5,
        safer_landing: true,
        read_time_minutes: 5,
        published_at: "2025-12-14",
        tags: ["chaos", "patterns", "analysis"]
    },
    {
        id: "judgment-calls",
        title: "Judgment Calls",
        slug: "judgment-calls",
        category: "Governance",
        excerpt: "Why systems need arbiters—and why arbiters need restraint.",
        department_id: "CJO",
        shadow_density: 6,
        safer_landing: false,
        read_time_minutes: 6,
        published_at: "2025-12-13",
        tags: ["judgment", "ethics", "authority"]
    },
    {
        id: "emotional-weather",
        title: "Emotional Weather Forecast",
        slug: "emotional-weather-forecast",
        category: "Emotion",
        excerpt: "Tracking emotional pressure systems before storms form.",
        department_id: "EWU",
        shadow_density: 3,
        safer_landing: true,
        read_time_minutes: 4,
        published_at: "2025-12-12",
        tags: ["emotion", "forecasting", "regulation"]
    },
    {
        id: "floof-epistemology",
        title: "Floof Epistemology",
        slug: "floof-epistemology",
        category: "Feline",
        excerpt: "Knowledge sits where it chooses.",
        department_id: "FE",
        shadow_density: 1,
        safer_landing: true,
        read_time_minutes: 2,
        published_at: "2025-12-11",
        tags: ["cats", "knowledge", "humor"]
    },
    {
        id: "lantern-rule",
        title: "The Lantern Rule",
        slug: "the-lantern-rule",
        category: "Principles",
        excerpt: "Illuminate without interrogation.",
        department_id: "SCMS",
        shadow_density: 4,
        safer_landing: true,
        read_time_minutes: 4,
        published_at: "2025-12-10",
        tags: ["ethics", "guidance", "care"]
    }
];

// ── INSERTS (IDEMPOTENT) ──────────────────────────────────
const insertNote = db.prepare(`
    INSERT OR IGNORE INTO lab_notes (
        id,
        title,
        slug,
        category,
        excerpt,
        content_html,
        content_md,
        department_id,
        shadow_density,
        coherence_score,
        safer_landing,
        read_time_minutes,
        published_at,
        created_at,
        updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertTag = db.prepare(`
  INSERT OR IGNORE INTO lab_note_tags (note_id, tag)
  VALUES (?, ?)
`);

const nowIso = () => new Date().toISOString();

const tx = db.transaction(() => {
    for (const note of notes) {
        const timestamp = nowIso();

        insertNote.run(
            note.id,
            note.title,
            note.slug,
            note.category,
            note.excerpt,
            note.content_html ?? null,
            note.content_md ?? null,
            note.department_id,
            note.shadow_density,
            note.coherence_score ?? 1.0,
            note.safer_landing ? 1 : 0,
            note.read_time_minutes,
            note.published_at,
            timestamp,
            timestamp
        );

        for (const tag of note.tags) {
            insertTag.run(note.id, tag);
        }
    }
});

tx();

console.log(`✅ Seeded ${notes.length} lab notes`);