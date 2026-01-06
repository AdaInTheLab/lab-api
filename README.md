# Human Pattern Lab API 🦊🔥

[![codecov](https://codecov.io/gh/AdaInTheLab/lab-api/graph/badge.svg?token=JR74ITCD3U)](https://codecov.io/gh/AdaInTheLab/lab-api)

The backend for **The Human Pattern Lab** — where human chaos gets
dissected, emotional weather gets forecasted, and creatures drop
unfiltered opinions on everything.

This API serves **Lab Notes** and supporting systems, backed by a
**SQLite Ledger**, powered by **Express**, and guarded by
**GitHub OAuth**.  
Public knowledge flows freely. Admin routes are… supervised. 😼

---

## Base URL

**Production:** `https://api.thehumanpatternlab.com`  
**Local development:** `http://localhost:8001`

> As of **v0.2.0**, routes are **root-based**.  
> The `/api` path prefix has been removed from canonical endpoints.

---

## Features

- **SQLite Ledger model** — append-first persistence powering note history and projections
- **Express + TypeScript** — simple, explicit, dependable
- **GitHub OAuth** — browser redirect + Device Flow (CLI-friendly)
- **Public endpoints** — read-only access to Lab Notes
- **Protected admin routes** — create, edit, delete notes (Carmel is watching)
- **Environment-based secrets** — no hardcoding, no nonsense

---

## Quick Start (Development)

```bash
git clone https://github.com/AdaInTheLab/lab-api.git
cd lab-api
npm install
cp .env.example .env
npm run dev
```

The API starts in watch mode with automatic reloads.

---

## Build & Run (Production)

```bash
npm run build
npm start
```

This compiles TypeScript to `dist/` and runs the built server.

---

## Environment Variables

```env
PORT=8001
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
SESSION_SECRET=your-random-long-secret-here
ALLOWED_GITHUB_USERNAME=your-github-username
DB_PATH=/path/to/lab.db
```

---

## Endpoints

### Public

- `GET /health`
- `GET /lab-notes`
- `GET /lab-notes/:slug`

### Admin (GitHub-authenticated)

- `GET /auth/github`
- `GET /auth/github/callback`
- `GET /auth/logout`
- `GET /admin/notes`
- `POST /admin/notes`
- `DELETE /admin/notes/:id`

### GitHub Device Flow (CLI support)

- `GET /github/device`
- `GET /github/device/poll/:device_code`

---

## Testing

```bash
npm test
```

Uses **Jest + Supertest** for API validation.

---

## Deployment

- **Host:** DreamHost VPS
- **API origin:** `api.thehumanpatternlab.com`
- **Reverse proxy:** Routes API subdomain traffic to `localhost:8001`
- **Process manager:** PM2

> The main site (`thehumanpatternlab.com`) is intentionally separate.  
> Legacy `/api/*` paths on the main domain are deprecated and redirected.

---

## Operations (PM2)

This API is intended to run under **PM2** in production.

### Quick Commands (Shell Aliases)

Add these to `~/.bashrc` or `~/.zshrc` on the VPS:

```bash
# ── Human Pattern Lab · API ─────────────────────────────
alias lab-api-start='pm2 start ecosystem.config.cjs --env production'
alias lab-api-restart='pm2 restart lab-api'
alias lab-api-stop='pm2 stop lab-api'
alias lab-api-logs='pm2 logs lab-api'
alias lab-api-status='pm2 status'
```

Reload your shell:

```bash
source ~/.bashrc
```

Usage:

```bash
lab-api-start
lab-api-logs
lab-api-restart
```

### NPM Scripts (Portable Ops)

These scripts live in `package.json`:

```bash
npm run pm2:start
npm run pm2:restart
npm run pm2:stop
npm run pm2:logs
npm run pm2:status
```

### Notes

- Prefer `pm2 restart lab-api` for routine deploys once the process exists.
- Use `pm2 start ecosystem.config.cjs --env production` for first boot.
- After first successful production start, persist the process list:

```bash
pm2 save
pm2 startup
```

(Then run the one-line command PM2 prints to enable startup on reboot.)

---

## Versioning

This API follows semantic versioning while pre-1.0.

- **v0.2.0**
  - Introduces the **Ledger** persistence model
  - Removes the `/api` route prefix
  - Canonical API base is `https://api.thehumanpatternlab.com`

Clients should rely only on documented HTTP endpoints, not internal DB structure.

---

## License

MIT

---

**The Human Pattern Lab**  
https://thehumanpatternlab.com

*The lantern is lit.  
The foxes are watching.*
