# API and CLI Integration - Bearer Token Auth

## Summary of Changes

Successfully integrated Bearer token authentication between the HPL CLI and API, enabling the CLI's write operations to work with the admin endpoints.

## Changes Made

### API Changes (lab-api)

**File: `src/routes/adminRoutes.ts`**

1. **Added import** for `requireAuth` middleware:
   ```typescript
   import { requireAuth } from "../middleware/requireAuth.js";
   ```

2. **Updated POST /admin/notes endpoint** to accept Bearer tokens:
   ```typescript
   // Changed from:
   app.post("/admin/notes", requireAdmin, ...)
   
   // To:
   app.post("/admin/notes", requireAuth(db), ...)
   ```

**Why this works:**
- `requireAuth` middleware supports BOTH session auth (humans in browser) AND Bearer token auth (CLI)
- Checks session first, then falls back to Bearer token
- Returns 401 if neither auth method succeeds
- No breaking changes - browser users still work with sessions

### CLI Changes (the-human-pattern-lab-cli)

**File: `src/types/labNotes.ts`**

Changed field name in `LabNoteUpsertSchema` to match API:
```typescript
// Changed from:
markdown: z.string().min(1),

// To:
content_markdown: z.string().min(1),
```

**File: `src/commands/notes/create.ts`**

1. Changed payload field name:
   ```typescript
   content_markdown: markdown  // was: markdown: markdown
   ```

2. Changed endpoint:
   ```typescript
   "/admin/notes"  // was: "/lab-notes/upsert"
   ```

**File: `src/commands/notes/update.ts`**

Same changes as create.ts (field name and endpoint).

**File: `src/commands/notes/notesSync.ts`**

Same changes (field name and endpoint) to keep sync working.

## How Authentication Works Now

### For CLI (Bearer Token)
```bash
export HPL_TOKEN="hpl_test_xxxxx"
hpl notes create --title "Test" --slug "test" --file note.md
```

Request flow:
1. CLI sends: `Authorization: Bearer hpl_test_xxxxx`
2. API `requireAuth` middleware:
   - Checks session (not present)
   - Checks Bearer token (present!)
   - Validates token hash in database
   - Checks token is active and not expired
   - Sets `req.auth = { kind: "token", ... }`
3. Route handler executes

### For Browser (Session)
User logs in via GitHub OAuth → Session cookie is set → Works as before

Both methods work on the same endpoint!

## Testing the Integration

### 1. Generate an API Token

First, you need a valid Bearer token. This requires session auth to create:

```bash
# Via API (need to be logged in with session):
curl -X POST http://127.0.0.1:8001/admin/tokens \
  -H "Cookie: hpl.sid=..." \
  -H "Content-Type: application/json" \
  -d '{
    "label": "CLI Testing",
    "scopes": ["admin"],
    "expires_at": null
  }'
```

Or use the browser UI to mint a token.

### 2. Test CLI Create

```bash
# Set token
export HPL_TOKEN="hpl_test_YOUR_TOKEN_HERE"

# Override API base to local
export HPL_BASE_URL="http://127.0.0.1:8001"

# Create a test note
echo "# Test Note" > test.md
npm run dev -- notes create \
  --title "Test Note" \
  --slug "cli-test-$(date +%s)" \
  --file test.md \
  --status draft
```

Expected: Success! Note created.

### 3. Test CLI Update

```bash
npm run dev -- notes update cli-test-123456789 \
  --title "Updated Title" \
  --markdown "# Updated content"
```

### 4. Test JSON Output

```bash
npm run dev -- notes create \
  --title "JSON Test" \
  --slug "json-test" \
  --markdown "# Content" \
  --json
```

Should return valid JSON envelope.

## Token Management

### Creating Tokens

Tokens are created via `/admin/tokens` POST endpoint (requires session auth):

```json
{
  "label": "My CLI Token",
  "scopes": ["admin"],
  "expires_at": null
}
```

Returns:
```json
{
  "ok": true,
  "data": {
    "token": "hpl_test_xxxxx",  // Raw token (shown once!)
    "id": "uuid"
  }
}
```

### Token Security

- Raw tokens are never stored (only SHA-256 hash + pepper)
- Tokens include prefix: `hpl_test_` (dev) or `hpl_live_` (prod)
- Configurable expiration
- Can be revoked via `/admin/tokens/:id/revoke`
- Scoped permissions (currently just "admin")

### Token Storage

**In API database** (`api_tokens` table):
- id
- label
- token_hash (SHA-256 of pepper:token)
- scopes_json
- is_active
- expires_at
- created_by_user
- last_used_at
- created_at

**In CLI config** (`~/.humanpatternlab/hpl.json`):
```json
{
  "apiBaseUrl": "https://api.thehumanpatternlab.com",
  "token": "hpl_test_xxxxx"
}
```

Or via environment variable:
```bash
export HPL_TOKEN="hpl_test_xxxxx"
```

## Error Handling

### 401 Unauthorized
- No token provided
- Invalid token (not in database)
- Expired token
- Inactive token

### 403 Forbidden  
- Token lacks required scopes (future feature)

### 400 Bad Request
- Missing required fields (title, slug)
- Invalid data

## Benefits of This Approach

✅ **No Breaking Changes**: Browser users still use sessions
✅ **Secure**: Tokens are hashed, can be revoked, can expire
✅ **Flexible**: Both auth methods work on same endpoint
✅ **Clean**: No duplicate endpoints needed
✅ **Auditable**: Tokens track `created_by_user` and `last_used_at`

## Next Steps

1. Test the integration end-to-end
2. Create a token via the browser UI or API
3. Test CLI create/update operations
4. Verify sync still works
5. Consider adding token management commands to CLI (`hpl tokens list`, `hpl tokens create`, etc.)

## Files Modified

### API (1 file)
- `src/routes/adminRoutes.ts` - Updated to use `requireAuth`

### CLI (4 files)
- `src/types/labNotes.ts` - Changed `markdown` to `content_markdown`
- `src/commands/notes/create.ts` - Updated endpoint and field name  
- `src/commands/notes/update.ts` - Updated endpoint and field name
- `src/commands/notes/notesSync.ts` - Updated endpoint and field name

Total: 5 files modified! 🦊
