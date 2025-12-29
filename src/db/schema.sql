PRAGMA foreign_keys = ON;

-- ---------- lab_notes ----------
CREATE TABLE IF NOT EXISTS lab_notes (
                                         id TEXT PRIMARY KEY,
                                         slug TEXT NOT NULL,
                                         locale TEXT NOT NULL DEFAULT 'en',

                                         title TEXT NOT NULL,
                                         status TEXT NOT NULL DEFAULT 'draft'
                                             CHECK (status IN ('draft','published','archived')),

                                         author TEXT NOT NULL,
                                         ai_author TEXT NULL,

                                         current_revision_id TEXT NULL,
                                         published_revision_id TEXT NULL,

                                         created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
                                         updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

                                         UNIQUE (slug, locale),

                                         FOREIGN KEY (current_revision_id) REFERENCES lab_note_revisions(id),
                                         FOREIGN KEY (published_revision_id) REFERENCES lab_note_revisions(id)
);

CREATE INDEX IF NOT EXISTS idx_lab_notes_status ON lab_notes(status);
CREATE INDEX IF NOT EXISTS idx_lab_notes_locale ON lab_notes(locale);

-- ---------- lab_note_revisions ----------
CREATE TABLE IF NOT EXISTS lab_note_revisions (
                                                  id TEXT PRIMARY KEY,
                                                  note_id TEXT NOT NULL,

                                                  revision_num INTEGER NOT NULL,
                                                  supersedes_revision_id TEXT NULL,

                                                  frontmatter_json TEXT NOT NULL,
                                                  content_markdown TEXT NOT NULL,
                                                  content_hash TEXT NOT NULL,

                                                  schema_version TEXT NOT NULL,
                                                  source TEXT NOT NULL CHECK (source IN ('cli','web','api','import')),

                                                  intent TEXT NOT NULL,
                                                  intent_version TEXT NOT NULL DEFAULT '1',

                                                  scope_json TEXT NOT NULL DEFAULT '[]',
                                                  side_effects_json TEXT NOT NULL DEFAULT '[]',
                                                  reversible INTEGER NOT NULL DEFAULT 1 CHECK (reversible IN (0,1)),

                                                  auth_type TEXT NOT NULL CHECK (auth_type IN ('human_session','lab_token')),
                                                  scopes_json TEXT NOT NULL DEFAULT '[]',

                                                  reasoning_json TEXT NULL,

                                                  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

                                                  UNIQUE (note_id, revision_num),

                                                  FOREIGN KEY (note_id) REFERENCES lab_notes(id) ON DELETE CASCADE,
                                                  FOREIGN KEY (supersedes_revision_id) REFERENCES lab_note_revisions(id)
);

CREATE INDEX IF NOT EXISTS idx_revisions_note ON lab_note_revisions(note_id);
CREATE INDEX IF NOT EXISTS idx_revisions_intent ON lab_note_revisions(intent);
CREATE INDEX IF NOT EXISTS idx_revisions_hash ON lab_note_revisions(content_hash);

-- ---------- lab_note_proposals ----------
CREATE TABLE IF NOT EXISTS lab_note_proposals (
                                                  id TEXT PRIMARY KEY,
                                                  note_id TEXT NOT NULL,

                                                  base_revision_id TEXT NOT NULL,
                                                  proposed_revision_id TEXT NOT NULL,

                                                  status TEXT NOT NULL DEFAULT 'pending'
                                                      CHECK (status IN ('pending','accepted','rejected','withdrawn')),

                                                  created_by TEXT NOT NULL,
                                                  created_by_type TEXT NOT NULL CHECK (created_by_type IN ('human','ai','system')),

                                                  reviewed_by TEXT NULL,
                                                  reviewed_at TEXT NULL,
                                                  review_comment TEXT NULL,

                                                  diff_patch TEXT NULL,

                                                  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

                                                  FOREIGN KEY (note_id) REFERENCES lab_notes(id) ON DELETE CASCADE,
                                                  FOREIGN KEY (base_revision_id) REFERENCES lab_note_revisions(id),
                                                  FOREIGN KEY (proposed_revision_id) REFERENCES lab_note_revisions(id)
);

CREATE INDEX IF NOT EXISTS idx_proposals_note ON lab_note_proposals(note_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON lab_note_proposals(status);

-- ---------- lab_events ----------
CREATE TABLE IF NOT EXISTS lab_events (
                                          id TEXT PRIMARY KEY,

                                          event_type TEXT NOT NULL,
                                          note_id TEXT NULL,
                                          revision_id TEXT NULL,
                                          proposal_id TEXT NULL,

                                          intent TEXT NULL,
                                          intent_version TEXT NULL,

                                          actor_type TEXT NOT NULL CHECK (actor_type IN ('human','ai','system')),
                                          actor_id TEXT NOT NULL,

                                          auth_type TEXT NULL CHECK (auth_type IN ('human_session','lab_token')),
                                          scopes_json TEXT NULL,

                                          payload_json TEXT NOT NULL DEFAULT '{}',

                                          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

                                          FOREIGN KEY (note_id) REFERENCES lab_notes(id) ON DELETE SET NULL,
                                          FOREIGN KEY (revision_id) REFERENCES lab_note_revisions(id) ON DELETE SET NULL,
                                          FOREIGN KEY (proposal_id) REFERENCES lab_note_proposals(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_events_type ON lab_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_note ON lab_events(note_id);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON lab_events(created_at);

-- ---------- lab_tokens ----------
CREATE TABLE IF NOT EXISTS lab_tokens (
                                          id TEXT PRIMARY KEY,
                                          token_hash TEXT NOT NULL UNIQUE,

                                          label TEXT NOT NULL,
                                          scopes_json TEXT NOT NULL DEFAULT '[]',

                                          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
                                          expires_at TEXT NULL,
                                          revoked_at TEXT NULL,
                                          last_used_at TEXT NULL
);

-- ---------- auth_sessions ----------
CREATE TABLE IF NOT EXISTS auth_sessions (
                                             id TEXT PRIMARY KEY,
                                             user_id TEXT NOT NULL,

                                             session_hash TEXT NOT NULL UNIQUE,

                                             created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
                                             expires_at TEXT NOT NULL,
                                             revoked_at TEXT NULL,
                                             last_seen_at TEXT NULL
);

-- ---------- device_auth_sessions ----------
CREATE TABLE IF NOT EXISTS device_auth_sessions (
                                                    id TEXT PRIMARY KEY,

                                                    device_code_hash TEXT NOT NULL UNIQUE,
                                                    user_code TEXT NOT NULL UNIQUE,
                                                    verification_uri TEXT NOT NULL,

                                                    status TEXT NOT NULL DEFAULT 'pending'
                                                        CHECK (status IN ('pending','approved','denied','expired')),

                                                    user_id TEXT NULL,

                                                    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
                                                    expires_at TEXT NOT NULL,
                                                    approved_at TEXT NULL
);
