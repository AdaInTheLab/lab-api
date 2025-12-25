// src/sdk/LabClient.ts

export interface Artifact {
    id: string;
    type: string;
    url: string;
    description?: string;
    created_at?: string;
}

export interface LabNote {
    id: string;
    title: string;
    slug: string;
    category?: string;
    excerpt?: string;
    department_id?: string;

    content?: string; // markdown
    author?: string;
    status: 'draft' | 'published' | 'archived';

    shadow_density: number;
    coherence_score: number;
    vcs_level?: number;
    safer_landing: boolean;

    read_time_minutes?: number;
    published_at?: string;
    updated_at?: string;

    tags: string[];
    artifacts: Artifact[];
}

export interface CreateOrUpdateNoteInput {
    id?: string;
    title: string;
    slug: string;
    category?: string;
    excerpt?: string;
    department_id?: string;

    content?: string;
    author?: string;
    status?: 'draft' | 'published' | 'archived';

    shadow_density?: number;
    coherence_score?: number;
    vcs_level?: number;
    safer_landing?: boolean;

    read_time_minutes?: number;
    published_at?: string;

    tags?: string[];
    artifacts?: Artifact[];
}

export class LabClient {
    private baseUrl: string;
    private token?: string;

    constructor(baseUrl: string, token?: string) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.token = token;
    }

    setToken(token: string) {
        this.token = token;
    }

    private headers() {
        const h: Record<string, string> = {
            'Content-Type': 'application/json'
        };
        if (this.token) {
            h['Authorization'] = `Bearer ${this.token}`;
        }
        return h;
    }

    //
    // ────────────────────────────────────────────────
    //   PUBLIC ROUTES
    // ────────────────────────────────────────────────
    //

    async getAllNotes(): Promise<LabNote[]> {
        const res = await fetch(`${this.baseUrl}/`, {
            method: 'GET',
            headers: this.headers()
        });
        if (!res.ok) throw new Error('Failed to fetch notes');
        return res.json();
    }

    async getNoteBySlug(slug: string): Promise<LabNote> {
        const res = await fetch(`${this.baseUrl}/notes/${slug}`, {
            method: 'GET',
            headers: this.headers()
        });
        if (!res.ok) throw new Error('Note not found');
        return res.json();
    }

    //
    // ────────────────────────────────────────────────
    //   ADMIN ROUTES
    // ────────────────────────────────────────────────
    //

    async getAdminNotes(): Promise<LabNote[]> {
        const res = await fetch(`${this.baseUrl}/api/admin/notes`, {
            method: 'GET',
            credentials: 'include',
            headers: this.headers()
        });
        if (!res.ok) throw new Error('Failed to fetch admin notes');
        return res.json();
    }

    async createOrUpdateNote(input: CreateOrUpdateNoteInput): Promise<{ message: string }> {
        const res = await fetch(`${this.baseUrl}/api/admin/notes`, {
            method: 'POST',
            credentials: 'include',
            headers: this.headers(),
            body: JSON.stringify(input)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to save note');
        }

        return res.json();
    }

    async deleteNote(id: string): Promise<{ message: string }> {
        const res = await fetch(`${this.baseUrl}/api/admin/notes/${id}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: this.headers()
        });

        if (!res.ok) throw new Error('Failed to delete note');
        return res.json();
    }

    //
    // ────────────────────────────────────────────────
    //   HEALTH
    // ────────────────────────────────────────────────
    //

    async health(): Promise<any> {
        const res = await fetch(`${this.baseUrl}/api/health`, {
            method: 'GET',
            headers: this.headers()
        });
        return res.json();
    }
}
