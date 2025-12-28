# Human Pattern Lab API 🦊🔥

The backend for **The Human Pattern Lab** --- where human chaos gets
dissected, emotional weather gets forecasted, and creatures drop
unfiltered opinions on everything.

This API serves **Lab Notes** and supporting systems, backed by
**SQLite**, powered by **Express**, and guarded by **GitHub OAuth**.\
Public knowledge flows freely. Admin routes are... supervised. 😼

------------------------------------------------------------------------

## Features

-   **SQLite database** --- the lantern that remembers every note
-   **Express + TypeScript** --- simple, explicit, dependable
-   **GitHub OAuth** --- browser redirect + Device Flow for CLI gremlins
-   **Public endpoints** --- read-only access to Lab Notes
-   **Protected admin routes** --- create, edit, delete notes (Carmel is
    watching)
-   **Environment-based secrets** --- no hardcoding, no nonsense

------------------------------------------------------------------------

## Quick Start (Development) 

``` bash
git clone https://github.com/AdaInTheLab/the-human-pattern-lab-api.git
cd the-human-pattern-lab-api
npm install
cp .env.example .env
npm run dev
```

The API will start in watch mode with automatic reloads.

------------------------------------------------------------------------

## Build & Run (Production)

``` bash
npm run build
npm start
```

This compiles TypeScript to `dist/` and runs the built server.

------------------------------------------------------------------------

## Environment Variables

PORT=8001\
GITHUB_CLIENT_ID=your-github-client-id\
GITHUB_CLIENT_SECRET=your-github-client-secret\
SESSION_SECRET=your-random-long-secret-here\
ALLOWED_GITHUB_USERNAME=your-github-username\
DB_PATH=/path/to/lab.db

------------------------------------------------------------------------

## Endpoints

### Public

-   GET /api/health
-   GET /api/lab-notes
-   GET /the-quiet-flame
-   GET /

### Admin (GitHub-authenticated)

-   GET /api/auth/github
-   GET /api/auth/github/callback
-   GET /api/auth/logout
-   GET /api/admin/notes
-   POST /api/admin/notes
-   DELETE /api/admin/notes/:id

### GitHub Device Flow

-   GET /github/device
-   GET /github/device/poll/:device_code

------------------------------------------------------------------------

## Testing

``` bash
npm test
```

Uses Jest + Supertest for API validation.

------------------------------------------------------------------------

## Deployment

-   **VPS**: DreamHost
-   **Reverse proxy**: Nginx (`/api/* → localhost:8001`)
-   **Process manager**: PM2

------------------------------------------------------------------------
## Operations (PM2)

This API is intended to run under **PM2** in production.

### Quick Commands (Shell Aliases)

On the VPS, add these to `~/.bashrc` (or `~/.zshrc`):

``` bash
# ── Human Pattern Lab · API ─────────────────────────────
alias lab-api-start='pm2 start ecosystem.config.cjs --env production'
alias lab-api-restart='pm2 restart lab-api'
alias lab-api-stop='pm2 stop lab-api'
alias lab-api-logs='pm2 logs lab-api'
alias lab-api-status='pm2 status'
```

Reload your shell:

``` bash
source ~/.bashrc
```

Usage:

``` bash
lab-api-start
lab-api-logs
lab-api-restart
```

### NPM Scripts (Portable Ops)

These scripts live in `package.json` so the operational workflow is
discoverable:

``` bash
npm run pm2:start
npm run pm2:restart
npm run pm2:stop
npm run pm2:logs
npm run pm2:status
```

### Notes

-   Prefer **`pm2 restart lab-api`** for routine deploys once the
    process exists.
-   `pm2 start ecosystem.config.cjs --env production` is ideal for first
    bootstrapping.
-   After the first successful production start, persist the process
    list:

``` bash
pm2 save
pm2 startup
```

(Then run the one-line command PM2 prints to enable startup on reboot.)


------------------------------------------------------------------------


## License

MIT

------------------------------------------------------------------------

**The Human Pattern Lab**\
https://thehumanpatternlab.com

*The lantern is lit.\
The foxes are watching.*
