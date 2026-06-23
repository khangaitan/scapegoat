# Gaon Report — songolt
Generated: 2026-06-22 19:27
Layer: projects
Run: four-gate parallel scan

## Summary

Songolt ("Scapegoat" in Mongolian) is a complete real-time multiplayer social-deduction game. Credit score: B — late beta. Functional and deployable; not yet verified-shipped. The work to reach "delivered" is bounded.

## vajra — Ground Truth

Canonical source: src/ (frontend) + backend/ only. Two stale duplicate trees from gaon-watch drop residue — ignore for all future work:
- songolt/songolt/ — full re-clone with own node_modules, package.json, 2026-06-19 GAON_REPORT stub
- source/src/ — partial clone missing lib/, main.tsx, pages/

Hard facts:
- Last build: 2026-06-08. dist/index.html (266KB JS) and backend/dist/index.mjs present.
- Split deploy: Netlify = frontend only. Backend = separate PaaS (Procfile). VITE_API_URL Netlify build env not recorded in-repo — frontend->backend prod connection unverified.
- backend/.env contains plaintext ADMIN_TOKEN=songolt-admin-2024. No git; unprotected on disk.
- pg declared as dep, unused — Drizzle is SQLite-only.
- No git, no test runner, no linter, no CI.
- OPENAI_API_KEY unset -> /api/story inert.
- Room state: in-memory Map only. Backend restart wipes all active games.

## ratna — Patterns & Structure

Ten established patterns correctly implemented: server-authoritative state, per-recipient fog-of-war (serializeRoom), lobby/room FSM (PHASE_ORDER), CQRS-lite socket protocol (commands+ack, events broadcast), two-phase host-gated special cards, singleton connection + useGame.ts sole owner, stable-identity reconnect (songolt_player_key UUID + rekeyPlayer), deal-without-replacement deck, one-time host code capability token.

Guardrails:
1. Never trust the client — serializeRoom is the enforcement point for all secrets
2. Dual GameRoom types (frontend/backend) must stay in sync — every shape change touches both
3. Authoritative timers only — server decides, client renders
4. rekeyPlayer is the reconnect contract — any new per-socket state must be added there
5. CORS must be locked — socketHandler.ts hardcodes origin:"*" bypassing CORS_ORIGIN env
6. Admin endpoints must hard-fail without token (currently 500 — make 401/403)

## padma — Workshop

What was built: A complete Mongolian-language social-deduction game with deep mechanics — 40 professions, 30 attribute cards, 30 special cards (all fully implemented), 20 phobias/extras, 25 bag items, 5 bunkers, 5 disasters. roundDebt anti-cheese mechanic wired front-to-back. Server-side turn timers with pause/resume. Host migration on disconnect. Admin panel for host code generation. OpenAI gpt-4o story generator (inert without key).

Known gaps: cards 29/30 narrative-only (no mechanical effect), clear_vote dead no-op at socketHandler.ts:571, no README.

## karma — Accomplishment

Verification:
[x] Frontend and backend build artifacts present (2026-06-08)
[x] Netlify deploy config valid
[x] E2E test harness exists
[ ] Tests NOT verified passing (require live server)
[ ] Backend deploy target not pinned
[ ] Duplicate source trees present
[ ] ADMIN_TOKEN plaintext in backend/.env
[ ] No README for a split-deployment project

Deliverable: late BETA. Both halves deploy. Gap to "delivered": delete duplicates, confirm tests green, pin backend URL, lock CORS, write deploy runbook.

## Action list

1. Delete songolt/ and source/ duplicate dirs — 5 min
2. Move ADMIN_TOKEN to env injection — 15 min
3. Fix Socket.IO CORS: read CORS_ORIGIN env in socketHandler.ts — 10 min
4. Record backend host + VITE_API_URL in deploy.md — 15 min
5. Wrap tests in vitest + spawned backend; add npm test — 2h
6. Write deploy README — 30 min
7. Extract shared types to shared/ package — 3h
8. Persist active room state to SQLite — 4h

Items 1-4 take under an hour and move the project to B+. Item 5 closes it to delivered.
