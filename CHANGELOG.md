## Unreleased

### Ops
- Add `ecosystem.config.cjs.example` template — the real `ecosystem.config.cjs`
  remains gitignored, but the template documents the canonical shape and the
  locally-managed-tunnel trap.

### Notes for future ops debugging

If `api.thehumanpatternlab.com` ever returns Cloudflare **error 1033 / HTTP 530**
("Argo Tunnel error / no available origin"), `pm2 logs cf-tunnel --err` will
usually show one of two things:

1. **`Provided Tunnel token is not valid.`** — the cf-tunnel `args` block in
   `ecosystem.config.cjs` is using the `--token <jwt>` form, but the tunnel was
   created locally (`cloudflared tunnel create`). Locally-managed tunnels
   authenticate via the cred file at `~/.cloudflared/<uuid>.json`, not a JWT.
   Fix: change the args to `["tunnel", "run", "<tunnel-name>"]`. See the
   `ecosystem.config.cjs.example` header comment for the full picture.

2. **PM2 process listed but with `▒▒` status / 0b memory / hundreds of restarts**
   — half-zombie entry. Underlying cloudflared process is gone or detached but
   PM2 still has the registry entry. Fix: `pm2 delete cf-tunnel && pm2 start
   ecosystem.config.cjs --only cf-tunnel && pm2 save`.

## v0.2.0 — Ledger Era + Canonical API Base

### Breaking
- API base is now `https://api.thehumanpatternlab.com`.
- Removed `/api` path prefix from canonical routes.
    - Example: `/lab-notes` (new) instead of `/api/lab-notes` (old).
- Main site legacy `/api/*` routes are deprecated and redirect to the API subdomain.

### Database
- Refactored persistence to the **Ledger** model.
    - Ledger becomes the canonical source of truth for note storage and mutation history.
    - Improves auditability and enables future CLI automation workflows.

### Notes API
- Lab Notes endpoints continue to support list + detail retrieval while backed by the Ledger model.
- Response shape remains compatible with existing UI normalization (fields unchanged unless noted).

### Ops / Deployment
- Production routing standardized: website on `thehumanpatternlab.com`, API on `api.thehumanpatternlab.com`.
- Reduced ambiguity between static site routes and API routes.

## [0.1.2] – 2025-12-29

### CORE [SCMS] Add v2 Lab Notes schema: append-only revisions + pointers 🧱

### NOTE [SCMS] reserve category field; do not map to type

### FIX [SCMS] Prevent double response in lab-notes route 🧹

- Remove duplicate res.json call in /lab-notes handler
- Ensure handler returns after sending response
- Eliminate "Cannot set headers after they are sent" errors
- Stabilize test output and runtime behavior

## [0.1.1] – 2025-12-29

### Added
- Idempotent database migration for `lab_notes`
- Lightweight schema version tracking via `schema_meta`
- Startup logging for applied schema changes

### Changed
- Centralized DB migration logic into a dedicated module
- Made database bootstrap resilient to existing / older schemas

### Notes
- No API behavior changes
- Safe to deploy over existing databases
