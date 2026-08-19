# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Songolt** is a Mongolian-language multiplayer web game — a "Bunker" (бункер) survival game where players are dealt hidden character cards, a disaster scenario is revealed, and players must convince others they deserve a spot in the bunker. The frontend is a pure client app; all game logic runs on a separate backend server over Socket.IO.

## Commands

```bash
npm run dev:all      # start real backend (port 3001) + Vite dev server (port 5173) together
npm run dev          # Vite dev server only (backend must already be running)
npm run dev:backend  # start backend only (builds then starts on port 3001)
npm run build        # production build → dist/
npm run preview      # serve the production build locally
```

The real backend lives in `backend/`. `npm run dev:all` builds and starts it alongside Vite. The backend requires no env vars for basic local dev (SQLite DB is created automatically at `backend/data/songolt.db`).

Alternative: `docker compose up` builds and runs both services in containers (`Dockerfile` for the frontend dev server, `backend/Dockerfile` for the backend) — avoids host Node-version and `better-sqlite3`-native-binary mismatches. See `mac-setup.md`.

No test runner is configured. There is no linter or formatter defined in package.json.

## Environment

**Frontend env vars:**
- `VITE_API_URL` — points at the backend (e.g. `https://my-backend.railway.app`). If unset, the socket connects to the same origin. The socket path is always `/api/socket.io`. For local dev, leave unset — `vite.config.ts` proxies all `/api` traffic to `http://localhost:3001`.

**Backend env vars** (set in `backend/.env` or as process env):
- `ADMIN_TOKEN` — required to use admin endpoints (generate/list host codes). Without it the admin routes return `403`; a wrong `x-admin-token` header returns `401`.
- `SQLITE_PATH` — path to the SQLite DB file (default: `./data/songolt.db` relative to the backend dir).
- `PORT` — listening port (default: 3001).
- `CORS_ORIGIN` — restrict CORS to a specific origin in production.

The end-of-game story feature (`/api/story`, `backend/src/routes/story.ts`) is **not** env-configurable and does not use OpenAI — it calls a local Ollama server hardcoded to `http://localhost:11434` (model `phi4-mini`). No API key enables it; it only works if Ollama is running and reachable on that host.

The admin panel is available at `?admin=1` or any path ending in `/admin`. It authenticates with the `ADMIN_TOKEN` value via `x-admin-token` header and hits REST endpoints at `/api/admin/...`.

## Game Rules

The official Mongolian rules are in `src/lib/rules.ts` (`GAME_RULES_MN`) for UI display. English summary for dev reference:

**Cards** — each player gets 10 cards (profession, health, age/gender, hobby, personality, phobia, extraInfo, bagItem, specialCard1, specialCard2). Profession must be revealed in round 1. Special cards are single-use and can be played at any time (eliminated players cannot use them).

**Bunker** — randomly selected each game; capacity = half of original player count.

**Round phases** (`reveal` → `discussion` → `reverseVote` → `defense` → `finalVote`):
1. **reveal** — each player takes a timed turn revealing cards (turn timer, per-round reveal limit applies)
2. **discussion** — open 60s timed discussion
3. **reverseVote** — each player votes for 1 person to potentially eliminate; top vote-getter(s) become defenders; if no votes, skip to next round
4. **defense** — each defender gets their allotted time to argue their case
5. **finalVote** — all players may cast/change vote targeting defenders only; most votes → eliminated; tie → no elimination this round

**End condition** — game ends when active players ≤ `Math.ceil(originalPlayerCount / 2)`; survivors win.

## Architecture

### Path alias

`@` resolves to `src/` (configured in `vite.config.ts`). All imports inside `src/` use this alias.

### State management: `useGame` hook (`src/hooks/useGame.ts`)

This is the central hub. It owns the Socket.IO connection (via the singleton in `src/lib/socket.ts`), listens for all server events, and exposes both state and action callbacks. All server communication goes through `emitWithAck`, which wraps `socket.emit` in a Promise with a 10-second timeout. The hook returns everything `App.tsx` needs; no other component talks to the socket directly.

One exception: `sendChat` is fire-and-forget — it calls `socket.emit` directly with no ack and no timeout, because dropped chat messages are acceptable.

Session persistence (room ID + player name) uses `localStorage` under keys `songolt_last_room` / `songolt_last_name`. The player's unique reconnect identity is a UUID stored as `songolt_player_key`.

`disconnectSocket()` is called explicitly on home navigation and on kick. The socket reconnects lazily the next time `getSocket()` is called (on room create/join).

### Screen routing (`src/App.tsx`)

Navigation is a simple `Screen` enum (`"lobby" | "waiting" | "playing"`), not a router. Screen transitions happen in `handleCreate/JoinRoom` (imperative) and via a `useEffect` that watches `room.status` to handle reconnect. The `/admin` route is detected by inspecting `window.location` and renders `<AdminPage>` directly.

URL parameters handled by `App.tsx`:
- `?room=CODE` — pre-fills the join tab with a room code (invite links). If this differs from the saved session's room, the "Resume" banner is suppressed.
- `?admin=1` or path ending in `/admin` — renders the admin page.

### Game data flow

The server is authoritative. Clients receive a full `GameRoom` object on every `room_update` event; there is no local mutation of game state. `broadcastRoom` in `socketHandler.ts` calls `serializeRoom(room, pid)` (defined in `backend/src/game/serializers.ts`) per socket — only the requesting player's own `hand` is populated, everyone else's is `null`. Flash card notifications (`card_revealed`) are managed as a separate `flashCards` array in `useGame.ts` with auto-expiry timers (4 s).

**Frontend vs backend `GameRoom` shapes still differ, but the wire shape is now a single shared source of truth.** The backend's internal representation (`BackendGameRoom`/`BackendPlayer` in `backend/src/game/types.ts`) stores `players` as `Map<string, Player>`; `serializeRoom` converts it to the shape defined once in `shared/types.ts` (`players: Player[]`, `isPaused` a plain boolean, `myVote` already resolved). `src/lib/types.ts` re-exports those same types from `shared/types.ts` rather than redeclaring them — when the wire shape needs to change, edit `shared/types.ts` and both sides pick it up automatically.

### Socket events

**Client → Server** (all except `chat_message` use a `cb(result)` callback):
- `create_room` / `join_room` — room entry; `join_room` handles reconnect by playerKey
- `start_game` / `restart_game` / `end_game` — host lifecycle controls
- `end_turn` — advance to next player or next phase (current player or host only)
- `next_phase` / `next_round` — host force-advance controls
- `pause_timer` / `resume_timer` / `stop_timer` / `restart_timer` — host timer controls
- `set_turn_duration` / `set_reveal_limit` — host config
- `reveal_card` — player reveals one card from their hand
- `cast_vote` / `clear_vote` — voting in reverseVote and finalVote phases
- `eliminate_player` — host manually eliminates (bypasses vote)
- `kick_player` — host removes a player from the room
- `request_special` — player signals intent to use a special card (toggles `requested` flag)
- `activate_special` — host actually executes a special card effect (with optional `targetId`)
- `chat_message` — fire-and-forget, no ack

**Server → Client:**
- `room_update` — full personalized `GameRoom` snapshot (sent after almost every action)
- `card_revealed` — flash notification for a revealed card
- `turn_changed` — which player's turn it now is
- `phase_changed` — new phase within the same round
- `round_started` — new round number
- `player_eliminated` — a player was removed from the game
- `game_over` — game ended; payload includes survivor list
- `room_closed` — room is being torn down (client should navigate home)
- `chat_message` / `system_chat` — in-room messages
- `player_left` — a player permanently left (after grace period)
- `kicked` — sent only to the kicked socket
- `timer_paused` / `timer_resumed` / `timer_stopped` — timer state changes

### Special card activation flow

Special cards use a two-step host-approval model:
1. **Player requests**: `request_special {slot}` — toggles `revealed.requested` on the card; a system chat message is broadcast so everyone knows.
2. **Host activates**: `activate_special {ownerId, slot, targetId?}` — server executes the card effect, emits any resulting `card_revealed` flashes, system chat, and `player_eliminated` if applicable.

The `SpecialCardTarget` type in `src/lib/types.ts` (`SPECIAL_CARD_TARGET` map) determines whether a target is required (`otherPlayer`, `anyPlayer`, `eliminatedPlayer`) or not (`none`). `SpecialCardActivator.tsx` uses this to conditionally show a player picker.

### Key types (`src/lib/types.ts`)

- `GameRoom` — the full room snapshot (players, phase, timer state, vote counts, etc.)
  - `status: "lobby" | "playing" | "ended"` — room lifecycle; drives screen transitions in `App.tsx`
  - `phase: GamePhase` — current within-round phase; drives UI inside `GameBoard`
- `Player` — includes `hand: PlayerHand | null` (only populated for the local player), `revealedCards`, `roundRevealCount`, `roundDebt`, elimination status
- `GamePhase` — `"reveal" | "discussion" | "reverseVote" | "defense" | "finalVote"`, ordered in `PHASE_ORDER`
- `CardCategory` — the 10 card slots on a player's hand
- `SpecialCardTarget` — controls who a special card can target; looked up by card ID from `SPECIAL_CARD_TARGET`

### Turn-based vs timed phases

`TURN_BASED_PHASES = ["reveal", "reverseVote", "defense"]` (in `backend/src/gameState.ts`) — these phases iterate through `turnOrder` one player at a time with an individual timer. `discussion` and `finalVote` have a single shared timer with no `currentTurnIndex` advancement.

### Card dealing

`backend/src/gameData.ts` holds all static card data as a typed `const`. At game start, `createRoomDecks()` shuffles each category into a per-room deck. `drawPlayerHandFromDecks()` deals from those decks without replacement, so two players never get the same card. If the pool runs dry (can happen at 15-16 players for special cards), the deck reshuffles — duplicates only become possible then. The `drawNew*` / `drawPlayerHand` functions (non-deck variants) are legacy and used only for the lobby placeholder hand.

### Round debt mechanic

`roundRevealCount` tracks how many cards a player revealed this round. At the end of each round (`nextRound` in `gameState.ts`), any reveals above the limit become `roundDebt` — carried to the next round and subtracted from what they're required to reveal. This prevents skipping obligations by front-loading reveals.

### Room creation

Creating a room requires a `hostCode` (a host authorization code) in addition to a player name. `consumeHostCode` in `backend/src/lib/hostCodes.ts` atomically marks the code used (one-time). Once a game ends and `room.terminated = true`, restarts are blocked — a new host code is required.

### Backend internals

**Build**: `backend/build.mjs` uses esbuild to bundle `src/index.ts` into `dist/index.mjs`. Not `tsc`. The `better-sqlite3` native module is externalized.

**In-memory state**: All active rooms live in the `rooms` Map in `gameState.ts`. Restarting the backend process clears all active games.

**Database**: SQLite via Drizzle ORM (`better-sqlite3`). The `host_codes` table is auto-created with `CREATE TABLE IF NOT EXISTS` at startup in `db/index.ts` — no migration runner is needed.

**Turn timers**: Server-side `setTimeout` in `socketHandler.ts` auto-advances turns when `turnEndsAt` is reached. Timer state (`turnEndsAt`, `pausedRemainingMs`, `isPaused`) is broadcast to clients on every `room_update` so the frontend can render a live countdown.

**Reconnect grace**: When a socket disconnects, the player is flagged `disconnected` but not removed immediately. Grace period: 20 s in lobby, 90 s during play. On reconnect, `rekeyPlayer` re-maps all turn order, vote target, voteCounts, and defendingPlayerIds from the old socket ID to the new one.

**Room teardown**: After a game ends, `tearDownRoom` schedules deletion after a 5-minute delay. It emits `room_closed` to all sockets, removes them from the Socket.IO room, and deletes the room from the map.

**Socket event pattern**: All client→server events except `chat_message` use a callback (`cb`) returning `{ success: boolean, error?: string }`. `chat_message` is fire-and-forget with no ack.

**Logging**: pino via `pino-http` middleware in `app.ts`; structured JSON logs. The logger instance is in `backend/src/lib/logger.ts`.

### Component layout

`GameBoard` is the main playing screen. It composes: `MyHand` (the local player's cards), `PlayerIcon` (each other player with their revealed cards), `AdminPanel` (host controls), `TurnTimer` + `TimerControls`, `ChatPanel`, `FlashReveal` (transient card reveal popups), `RoundBanner`, `WinnerPopup`, and `SpecialCardActivator`. `PlayerHistoryModal` (opened from `PlayerIcon`) shows a player's full card reveal history.

### Styling

Tailwind CSS v4 (via `@tailwindcss/vite` plugin). The app always runs in dark mode (`<div className="dark">`). UI primitives are shadcn/ui-style components in `src/components/ui/`.

### Deployment

Split deployment: static frontend on Netlify (`netlify.toml` sets build command to `npm install && npm run build`, publish dir to `dist`, and adds a catch-all redirect to `index.html` for SPA routing), backend on a separate long-running host (Railway/Render/Fly.io, either via buildpacks or `backend/Dockerfile`). Full instructions in `deploy.md`; for local dev via Docker (including on a fresh Mac) see `mac-setup.md`.
