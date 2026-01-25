// src/db/relayStore.ts
import type Database from "better-sqlite3";
import { randomBytes } from "crypto";

export interface RelaySession {
  id: string;
  voice: string;
  created_at: string;
  expires_at: string;
  used: boolean;
  used_at: string | null;
  created_by: string;
}

/**
 * Parse duration strings like "1h", "30m", "2d"
 * Returns milliseconds
 */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 3600000; // Default 1 hour

  const [, amount, unit] = match;
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60000,
    h: 3600000,
    d: 86400000,
  };

  return parseInt(amount) * multipliers[unit];
}

/**
 * Generate new relay session
 */
export function createRelaySession(
  db: Database.Database,
  voice: string,
  expiresIn: string = "1h"
): RelaySession {
  const id = "relay_" + randomBytes(8).toString("hex");
  const expiresAt = new Date(Date.now() + parseDuration(expiresIn)).toISOString();

  db.prepare(`
    INSERT INTO relay_sessions (id, voice, expires_at)
    VALUES (?, ?, ?)
  `).run(id, voice, expiresAt);

  const session = db
    .prepare(`SELECT * FROM relay_sessions WHERE id = ?`)
    .get(id) as RelaySession;

  return session;
}

/**
 * Get relay session by ID
 */
export function getRelaySession(
  db: Database.Database,
  relayId: string
): RelaySession | undefined {
  return db
    .prepare(`SELECT * FROM relay_sessions WHERE id = ?`)
    .get(relayId) as RelaySession | undefined;
}

/**
 * Mark relay as used (ATOMIC operation)
 * Returns true if marked, false if already used
 */
export function markRelayUsed(
  db: Database.Database,
  relayId: string
): boolean {
  const result = db.prepare(`
    UPDATE relay_sessions 
    SET 
      used = 1, 
      used_at = CURRENT_TIMESTAMP
    WHERE id = ? AND used = 0
  `).run(relayId);

  // If changes === 0, it was already used or doesn't exist
  return result.changes > 0;
}

/**
 * List active relays (not used, not expired)
 */
export function listActiveRelays(
  db: Database.Database,
  voice?: string
): RelaySession[] {
  if (voice) {
    return db.prepare(`
      SELECT * FROM relay_sessions 
      WHERE voice = ? 
        AND used = 0 
        AND expires_at > CURRENT_TIMESTAMP
      ORDER BY created_at DESC
    `).all(voice) as RelaySession[];
  }

  return db.prepare(`
    SELECT * FROM relay_sessions 
    WHERE used = 0 
      AND expires_at > CURRENT_TIMESTAMP
    ORDER BY created_at DESC
  `).all() as RelaySession[];
}

/**
 * Revoke relay (mark as used)
 */
export function revokeRelay(
  db: Database.Database,
  relayId: string
): boolean {
  const result = db.prepare(`
    UPDATE relay_sessions 
    SET used = 1 
    WHERE id = ?
  `).run(relayId);

  return result.changes > 0;
}

/**
 * Clean up expired or old used relays
 * Returns number of deleted rows
 */
export function cleanupExpiredRelays(
  db: Database.Database,
  olderThanDays: number = 7
): number {
  const result = db.prepare(`
    DELETE FROM relay_sessions 
    WHERE expires_at < CURRENT_TIMESTAMP
       OR (used = 1 AND used_at < datetime('now', '-' || ? || ' days'))
  `).run(olderThanDays);

  return result.changes;
}
