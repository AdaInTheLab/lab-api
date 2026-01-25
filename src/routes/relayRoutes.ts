// src/routes/relayRoutes.ts
import type { Request, Response, Router } from "express";
import type Database from "better-sqlite3";
import {
  getRelaySession,
  markRelayUsed,
  createRelaySession,
  listActiveRelays,
  revokeRelay,
} from "../db/relayStore.js";
import { randomUUID } from "crypto";
import { sha256Hex } from "../lib/helpers.js";

/**
 * Register relay endpoints
 * 
 * The relay service enables AI agents with credential restrictions
 * to post Lab Notes using temporary, single-use URLs.
 */
export function registerRelayRoutes(app: Router, db: Database.Database) {
  /**
   * POST /relay/:relayId
   * 
   * Accept content from agents and proxy to internal note creation
   * with system credentials. The relay validates the session and
   * automatically adds voice metadata.
   */
  app.post("/relay/:relayId", async (req: Request, res: Response) => {
    const { relayId } = req.params;
    const { title, content, tags = [] } = req.body;

    try {
      // 1. Validate relay session
      const session = getRelaySession(db, relayId);

      if (!session) {
        return res.status(403).json({
          success: false,
          error: "Invalid relay ID",
          code: "INVALID_RELAY",
        });
      }

      if (session.used) {
        return res.status(403).json({
          success: false,
          error: "Relay already used",
          code: "ALREADY_USED",
        });
      }

      if (new Date(session.expires_at) < new Date()) {
        return res.status(403).json({
          success: false,
          error: "Relay expired",
          code: "EXPIRED_RELAY",
        });
      }

      // 2. Mark as used (atomic)
      const marked = markRelayUsed(db, relayId);
      if (!marked) {
        // Race condition - another request got here first
        return res.status(403).json({
          success: false,
          error: "Relay already used",
          code: "ALREADY_USED",
        });
      }

      // 3. Apply voice metadata
      const voiceTags = [...(Array.isArray(tags) ? tags : []), `vocal-${session.voice}`];
      
      // 4. Create Lab Note using same logic as admin endpoint
      const noteId = randomUUID();
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const locale = "en";
      const noteStatus = "published";
      const publishedAt = new Date().toISOString().slice(0, 10);
      
      const bodyMarkdown = String(content ?? "");
      
      const tx = db.transaction(() => {
        // Insert/update metadata row
        db.prepare(`
          INSERT INTO lab_notes (
            id, title, slug, locale,
            type, status,
            category, excerpt,
            published_at,
            updated_at
          )
          VALUES (
            ?, ?, ?, ?,
            ?, ?,
            ?, ?,
            ?,
            strftime('%Y-%m-%dT%H:%M:%fZ','now')
          )
          ON CONFLICT(slug, locale) DO UPDATE SET
            title=excluded.title,
            type=excluded.type,
            status=excluded.status,
            category=excluded.category,
            excerpt=excluded.excerpt,
            published_at=excluded.published_at,
            updated_at=excluded.updated_at
        `).run(
          noteId,
          title,
          slug,
          locale,
          "labnote",
          noteStatus,
          "Uncategorized",
          "",
          publishedAt
        );

        // Create revision
        const revRow = db
          .prepare(`
            SELECT COALESCE(MAX(revision_num), 0) AS maxRev
            FROM lab_note_revisions
            WHERE note_id = ?
          `)
          .get(noteId) as { maxRev: number } | undefined;

        const nextRev = (revRow?.maxRev ?? 0) + 1;
        const revisionId = randomUUID();

        const prevPointer = db
          .prepare(`SELECT current_revision_id AS cur FROM lab_notes WHERE id = ?`)
          .get(noteId) as { cur?: string } | undefined;

        const frontmatter = {
          id: noteId,
          slug,
          locale,
          type: "labnote",
          status: noteStatus,
          published_at: publishedAt,
          voice: session.voice,
        };

        const canonical = `${JSON.stringify(frontmatter)}\n---\n${bodyMarkdown}`;
        const contentHash = sha256Hex(canonical);

        db.prepare(`
          INSERT INTO lab_note_revisions (
            id, note_id, revision_num, supersedes_revision_id,
            frontmatter_json, content_markdown, content_hash,
            schema_version, source,
            intent, intent_version,
            scope_json, side_effects_json, reversible,
            auth_type, scopes_json,
            reasoning_json,
            created_at
          )
          VALUES (
            ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?,
            ?, ?,
            ?, ?, ?,
            ?, ?,
            NULL,
            strftime('%Y-%m-%dT%H:%M:%fZ','now')
          )
        `).run(
          revisionId,
          noteId,
          nextRev,
          prevPointer?.cur ?? null,
          JSON.stringify(frontmatter),
          bodyMarkdown,
          contentHash,
          "0.1",
          "relay",
          "voice_manifestation",
          "1",
          JSON.stringify(["db"]),
          JSON.stringify(["create_note"]),
          1,
          "relay_session",
          JSON.stringify([])
        );

        // Update pointers
        db.prepare(`
          UPDATE lab_notes
          SET
            current_revision_id = ?,
            published_revision_id = ?,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
          WHERE id = ?
        `).run(revisionId, revisionId, noteId);

        // Add tags
        for (const tag of voiceTags) {
          db.prepare(`
            INSERT OR IGNORE INTO lab_note_tags (note_id, tag)
            VALUES (?, ?)
          `).run(noteId, tag);
        }

        return { noteId, revisionId };
      });

      const { noteId: savedId } = tx();

      // 5. Log for audit trail
      console.log(`[RELAY] ${session.voice} posted: "${title}" via ${relayId}`);

      // 6. Return success
      return res.json({
        success: true,
        note_id: savedId,
        voice: session.voice,
        published_at: publishedAt,
      });
    } catch (error: any) {
      console.error("[RELAY ERROR]", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  });

  /**
   * Admin endpoints for relay management
   * These are protected by requireAdmin middleware
   */
  
  // Generate new relay
  app.post("/admin/relay/generate", (req: Request, res: Response) => {
    try {
      const { voice, expires = "1h" } = req.body;

      if (!voice) {
        return res.status(400).json({ error: "voice is required" });
      }

      const session = createRelaySession(db, voice, expires);
      const baseUrl = process.env.API_BASE_URL || "http://localhost:3001";
      const url = `${baseUrl}/relay/${session.id}`;

      return res.json({
        relay_id: session.id,
        voice: session.voice,
        expires_at: session.expires_at,
        url,
      });
    } catch (error: any) {
      return res.status(500).json({
        error: "Failed to generate relay",
        details: error.message,
      });
    }
  });

  // List active relays
  app.get("/admin/relay/list", (req: Request, res: Response) => {
    try {
      const { voice } = req.query;
      const relays = listActiveRelays(db, voice as string | undefined);

      return res.json({
        relays,
        count: relays.length,
      });
    } catch (error: any) {
      return res.status(500).json({
        error: "Failed to list relays",
        details: error.message,
      });
    }
  });

  // Revoke relay
  app.post("/admin/relay/revoke", (req: Request, res: Response) => {
    try {
      const { relay_id } = req.body;

      if (!relay_id) {
        return res.status(400).json({ error: "relay_id is required" });
      }

      const revoked = revokeRelay(db, relay_id);

      if (revoked) {
        return res.json({ success: true, relay_id });
      } else {
        return res.status(404).json({
          success: false,
          error: "Relay not found or already used",
        });
      }
    } catch (error: any) {
      return res.status(500).json({
        error: "Failed to revoke relay",
        details: error.message,
      });
    }
  });
}
