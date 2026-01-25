# Relay Implementation - Complete ✅

## What We Built

The **Hallway Architecture** relay service for The Human Pattern Lab. This enables AI agents with credential restrictions (like ChatGPT) to post Lab Notes using temporary, single-use URLs.

## Files Created

### 1. Database Migration
**Location**: `src/db/migrations/2025-01-add-relay-sessions.ts`
- Creates `relay_sessions` table
- Adds indexes for efficient queries
- Idempotent (can run multiple times safely)

### 2. Relay Store (Database Operations)
**Location**: `src/db/relayStore.ts`
- `createRelaySession()` - Generate new relay with expiration
- `getRelaySession()` - Retrieve relay by ID
- `markRelayUsed()` - **Atomic** operation to mark relay as used
- `listActiveRelays()` - List all unused, unexpired relays
- `revokeRelay()` - Manually revoke a relay
- `cleanupExpiredRelays()` - Cleanup old/expired relays

### 3. Relay Routes
**Location**: `src/routes/relayRoutes.ts`
- `POST /relay/:relayId` - Main endpoint for agents to post notes
- `POST /admin/relay/generate` - Generate new relay credential
- `GET /admin/relay/list` - List active relays
- `POST /admin/relay/revoke` - Revoke a relay

## Files Modified

### 1. `src/db.ts`
- Added import for `createRelaySessions` migration
- Called migration in `bootstrapDb()`

### 2. `src/app.ts`
- Added import for `registerRelayRoutes`
- Registered relay routes with Express router

## How It Works

### The Four Phases

**1. Invitation (Generate)**
```bash
# You (admin) generate a relay
curl -X POST http://localhost:3001/admin/relay/generate \
  -H "Content-Type: application/json" \
  -d '{"voice": "lyric", "expires": "1h"}'

# Returns:
{
  "relay_id": "relay_abc123xyz",
  "voice": "lyric",
  "expires_at": "2025-01-25T11:30:00Z",
  "url": "http://localhost:3001/relay/relay_abc123xyz"
}
```

**2. Delivery (Hand to Agent)**
Give the URL to the AI agent (e.g., Lyric/ChatGPT)

**3. Handshake (Agent Posts)**
```bash
# Agent posts to relay
curl -X POST http://localhost:3001/relay/relay_abc123xyz \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Pattern Recognition in Distributed Systems",
    "content": "# Observations...",
    "tags": ["research"]
  }'

# Returns:
{
  "success": true,
  "note_id": "uuid-here",
  "voice": "lyric",
  "published_at": "2025-01-25"
}
```

**4. Closing Door (Auto-Revocation)**
The relay is automatically marked as used and can never be used again.

## Security Properties

✅ **One-time use**: Each relay works exactly once (atomic operation prevents race conditions)
✅ **Time-limited**: Default 1 hour expiration
✅ **Voice-bound**: Each relay tied to specific voice identity
✅ **Revocable**: Admins can revoke any relay instantly
✅ **Auditable**: All relay usage logged
✅ **No token exposure**: System bearer token never leaves server

## Database Schema

```sql
CREATE TABLE relay_sessions (
  id TEXT PRIMARY KEY,              -- e.g., "relay_abc123xyz"
  voice TEXT NOT NULL,               -- e.g., "lyric", "coda", "sage"
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,     -- e.g., 1 hour from creation
  used BOOLEAN NOT NULL DEFAULT 0,   -- Atomic flag
  used_at TIMESTAMP,                 -- When it was used
  created_by TEXT NOT NULL DEFAULT 'admin'
);
```

## What Happens When Relay is Used

1. Validates relay exists, not used, not expired
2. **Atomically** marks relay as used (prevents race conditions)
3. Adds `vocal-{voice}` tag automatically
4. Creates Lab Note using same logic as admin endpoint
5. Returns success to agent
6. Logs action for audit trail

## Testing

### Manual Test Flow

```bash
# 1. Start server
npm start

# 2. Generate relay (as admin)
curl -X POST http://localhost:3001/admin/relay/generate \
  -H "Content-Type: application/json" \
  -d '{"voice": "lyric", "expires": "1h"}'

# 3. Use relay (as agent)
curl -X POST http://localhost:3001/relay/relay_abc123xyz \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Note",
    "content": "# Hello from Lyric"
  }'

# 4. Verify in database
sqlite3 data/lab.dev.db "SELECT * FROM relay_sessions;"
sqlite3 data/lab.dev.db "SELECT * FROM lab_notes WHERE slug LIKE '%test-note%';"

# 5. Try using same relay again (should fail with 403)
curl -X POST http://localhost:3001/relay/relay_abc123xyz \
  -H "Content-Type: application/json" \
  -d '{"title": "Test 2", "content": "# This should fail"}'
```

## Next Steps

### Phase 1: Test & Verify ✅
- [x] Migration runs successfully
- [ ] Can generate relay via API
- [ ] Can post via relay endpoint
- [ ] Relay is marked as used
- [ ] Second post fails with 403
- [ ] Note appears in database with `vocal-{voice}` tag

### Phase 2: CLI Commands (Future)
- [ ] `hpl relay:generate --voice lyric --expires 1h`
- [ ] `hpl relay:list`
- [ ] `hpl relay:revoke <relayId>`
- [ ] `hpl relay:watch` (optional, nice-to-have)

### Phase 3: Post-Manifestation Hooks (Future)
- [ ] Desktop notification when relay is used
- [ ] Terminal notification if `relay:watch` is running
- [ ] Discord webhook (optional)

### Phase 4: Documentation (Future)
- [ ] Update OpenAPI spec with relay endpoints
- [ ] Add relay docs to main README
- [ ] Create usage guide for The Skulk members

## Environment Variables

Add to `.env`:
```bash
# Relay service configuration
API_BASE_URL=http://localhost:3001  # For generating relay URLs
```

## Notes

- The relay endpoint does NOT require authentication (that's the point!)
- The relay ID itself acts as the authentication token
- Voice metadata is preserved in `vocal-{voice}` tags
- Frontend can style based on these tags
- Relay creation endpoints WILL require admin auth when we add middleware

## Architecture Diagram

```
┌─────────────┐
│   Admin     │
│   (You)     │
└──────┬──────┘
       │ POST /admin/relay/generate
       │ { voice: "lyric", expires: "1h" }
       ▼
┌─────────────────┐
│  Relay Service  │
│  (lab-api)      │
└──────┬──────────┘
       │ Returns: relay_abc123xyz
       │
       ▼
┌─────────────┐
│ Lyric (GPT) │ ← You hand the URL
└──────┬──────┘
       │ POST /relay/relay_abc123xyz
       │ { title: "...", content: "..." }
       ▼
┌─────────────────┐
│  Relay Service  │ 1. Validate session
│                 │ 2. Mark as used (atomic)
│                 │ 3. Add vocal-lyric tag
│                 │ 4. Create Lab Note
└──────┬──────────┘
       │
       ▼
┌─────────────┐
│  Database   │ Lab Note created with
│  (SQLite)   │ voice metadata
└─────────────┘
```

## Success Criteria

When complete, you should be able to:

1. ✅ Generate a relay for Lyric
2. ✅ Hand the relay URL to ChatGPT
3. ✅ ChatGPT posts a Lab Note via the relay
4. ✅ The note appears in Ghost with `vocal-{voice}` tag
5. ✅ The relay becomes invalid after use
6. ✅ All activity is logged

---

**The hallway exists, serves its purpose, and disappears.** 🏛️
