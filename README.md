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

## License

MIT

------------------------------------------------------------------------

**The Human Pattern Lab**\
https://thehumanpatternlab.com

*The lantern is lit.\
The foxes are watching.*
