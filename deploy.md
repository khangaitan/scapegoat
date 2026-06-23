# Deployment

Songolt is a **split deployment**: static frontend on Netlify, stateful backend on a separate PaaS (Railway / Heroku / Render).

## Frontend — Netlify

- Build: `npm install && npm run build` → publishes `dist/`
- Config: `netlify.toml` (already correct)
- **Required env var in Netlify dashboard:**
  ```
  VITE_API_URL=https://<your-backend-host>
  ```
  Leave unset for local dev — Vite proxies `/api` to `localhost:3001` automatically.

## Backend — PaaS (Procfile-based)

- Start command: `npm run build && npm start` (from `backend/`)
- Port: `$PORT` (set by platform) or defaults to 3001
- **Required env vars on the backend host:**
  ```
  ADMIN_TOKEN=<strong random secret>     # required for admin endpoints
  CORS_ORIGIN=https://<your-netlify-url> # lock down socket CORS in production
  SQLITE_PATH=./data/songolt.db          # or absolute path on persistent volume
  PORT=3001                              # usually set by platform automatically
  ```
  Optional:
  ```
  OPENAI_API_KEY=sk-...                  # enables /api/story end-of-game narrative
  ```

## Current deployment targets

| Component | Host | URL |
|-----------|------|-----|
| Frontend  | Netlify | <!-- fill in: https://songolt.netlify.app --> |
| Backend   | <!-- fill in: Railway / Render / etc. --> | <!-- fill in: https://songolt-backend.up.railway.app --> |

**Update this table when you deploy.**

## Notes

- Backend restart wipes all active game rooms (in-memory state). Only host codes persist (SQLite).
- `better-sqlite3` requires a persistent volume — do not use ephemeral storage.
- `ADMIN_TOKEN` is required to generate host codes. Without it, `/api/admin/codes` returns 500 (fix in progress to return 401).
