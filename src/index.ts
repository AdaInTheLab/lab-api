// src/index.ts
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import axios from 'axios';
import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import session from 'express-session';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 8001;

app.use(cors());
app.use(express.json());

// --- 🧬 THE STACKS INTERFACES ---
interface LabNote {
    id: string;
    title: string;
    slug: string;
    category?: string;
    excerpt?: string;
    department_id?: string;
    shadow_density?: number;
    coherence_score?: number;
    safer_landing?: number;
    read_time_minutes?: number;
    published_at?: string;
}

interface TagResult {
    tag: string;
}

const dbPath = './data/lab.db'; // Adjusted for local dev
const db = new Database(dbPath, { verbose: console.log });

// Initialize Substrate with Energetic Metadata
db.exec(`
    CREATE TABLE IF NOT EXISTS lab_notes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        category TEXT,
        excerpt TEXT,
        department_id TEXT DEFAULT 'SCMS',
        shadow_density INTEGER DEFAULT 0,
        coherence_score REAL DEFAULT 1.0,
        safer_landing BOOLEAN DEFAULT 0,
        read_time_minutes INTEGER,
        published_at TEXT
    );

    CREATE TABLE IF NOT EXISTS lab_note_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        note_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        UNIQUE(note_id, tag),
        FOREIGN KEY (note_id) REFERENCES lab_notes(id) ON DELETE CASCADE
    );

    CREATE VIEW IF NOT EXISTS v_lab_notes AS
    SELECT * FROM lab_notes;
`);

// --- 🛡️ AUTHENTICATION HANDSHAKE ---
app.use(session({
    secret: process.env.SESSION_SECRET ?? 'default-secret-for-dev',
    resave: false,
    saveUninitialized: false,
}));

// Fixed Implicit Any errors
passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    callbackURL: 'https://thehumanpatternlab.com/api/auth/github/callback'
}, (accessToken: string, refreshToken: string, profile: any, done: (err: any, user?: any) => void) => {
    if (profile.username !== process.env.ALLOWED_GITHUB_USERNAME) {
        return done(new Error('Access denied'));
    }
    return done(null, profile);
}));

passport.serializeUser((user: any, done: (err: any, id?: any) => void) => done(null, user));
passport.deserializeUser((user: any, done: (err: any, user?: any) => void) => done(null, user));

app.use(passport.initialize());
app.use(passport.session());

const ensureAuthenticated = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: 'Unauthorized' });
};

// --- 📡 API ENDPOINTS ---

// Public feed with integrated tags and metadata
app.get('/', (req: Request, res: Response) => {
    const notes = db.prepare('SELECT * FROM v_lab_notes').all() as LabNote[];

    const withTags = notes.map(note => {
        const tags = db.prepare('SELECT tag FROM lab_note_tags WHERE note_id = ?').all(note.id) as TagResult[];
        return {
            ...note,
            tags: tags.map((t: TagResult) => t.tag)
        };
    });

    res.json(withTags);
});

// Protected Post logic
app.post('/api/admin/notes', ensureAuthenticated, (req: Request, res: Response) => {
    const {
        id, title, slug, category, excerpt,
        department_id, shadow_density, coherence_score,
        safer_landing, read_time_minutes, published_at
    } = req.body;

    const stmt = db.prepare(`
        INSERT OR REPLACE INTO lab_notes (
            id, title, slug, category, excerpt, 
            department_id, shadow_density, coherence_score, 
            safer_landing, read_time_minutes, published_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
        stmt.run(
            id || Date.now().toString(),
            title,
            slug,
            category || 'Uncategorized',
            excerpt || '',
            department_id || 'SCMS',
            shadow_density || 0,
            coherence_score || 1.0,
            safer_landing ? 1 : 0,
            read_time_minutes || 5,
            published_at || new Date().toISOString().split('T')[0]
        );
        res.status(201).json({ message: 'Note saved with energetic metadata' });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', dbPath });
});

app.listen(port, () => {
    console.log(`🏮 Lab API running on http://localhost:${port}`);
});