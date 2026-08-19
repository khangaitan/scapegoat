# Deployment

Songolt is a **split deployment**: static frontend on Netlify, stateful backend on a separate
host that can run a long-lived Node process (Railway / Render / Fly.io / a plain VPS).

Source: [github.com/khangaitan/scapegoat](https://github.com/khangaitan/scapegoat) (public).

> This file covers **production** deployment. For running the stack locally (including on a
> fresh Mac via Docker), see [mac-setup.md](mac-setup.md) instead.

## Frontend — Netlify

- Build: `npm install && npm run build` → publishes `dist/`
- Config: `netlify.toml` (already correct) — connect the Netlify site directly to the GitHub repo above
- **Required env var in Netlify dashboard:**
  ```
  VITE_API_URL=https://<your-backend-host>
  ```
  Leave unset for local dev — Vite proxies `/api` to `localhost:3001` automatically.

## Backend

Two ways to build/run it on the host, same env vars either way:

- **Procfile-style PaaS** (Railway/Render buildpacks): start command `npm run build && npm start` (from `backend/`).
- **Docker**: use [`backend/Dockerfile`](backend/Dockerfile) directly — most PaaS hosts (Render, Fly.io, Railway) accept
  "deploy from Dockerfile" as an alternative to buildpacks. It already includes the native-module build tools
  `better-sqlite3` needs.

- Port: `$PORT` (set by platform) or defaults to 3001
- **Required env vars on the backend host:**
  ```
  ADMIN_TOKEN=<strong random secret>     # required for admin endpoints
  CORS_ORIGIN=https://<your-netlify-url> # lock down socket CORS in production
  SQLITE_PATH=./data/songolt.db          # or absolute path on persistent volume
  PORT=3001                              # usually set by platform automatically
  ```
  There is no working API-key-based option for the end-of-game story feature at the moment —
  `/api/story` (`backend/src/routes/story.ts`) calls a **local Ollama server**
  (`http://localhost:11434`, model `phi4-mini`), not OpenAI or any hosted API. On most PaaS hosts
  there's no Ollama reachable at `localhost`, so this one endpoint will fail (503) unless Ollama is
  also deployed and `OLLAMA_URL` in `story.ts` is pointed at it. Everything else in the game is
  unaffected.

## Current deployment targets

| Component | Host | URL |
|-----------|------|-----|
| Frontend  | Netlify | <!-- fill in: https://songolt.netlify.app --> |
| Backend   | <!-- fill in: Railway / Render / etc. --> | <!-- fill in: https://songolt-backend.up.railway.app --> |

**Nothing is deployed yet — update this table once you actually deploy.**

## Notes

- Backend restart wipes all active game rooms (in-memory state). Only host codes persist (SQLite).
- `better-sqlite3` requires a persistent volume — do not use ephemeral storage.
- `ADMIN_TOKEN` is required to generate host codes. Without it, `/api/admin/*` returns `403`;
  with it but a wrong `x-admin-token` header, `401`.
