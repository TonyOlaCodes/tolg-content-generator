# Elephant in the Room

A real-time online multiplayer social deduction game. Everyone has a job, someone is
sabotaging it, and nobody talks about the elephant.

**3–8 players · one 6-minute shift · one enormously inconvenient elephant.**

Players work a hotel: making beds, sorting laundry, serving meals, checking guests in. One
or two of them are secretly Saboteurs with fake jobs and seven sabotage tools. A very large
elephant wanders the building, and guests on an inspection route raise the **Exposure** meter
whenever they can actually see it. Staff win by finishing the work; Saboteurs win by getting
the elephant noticed, or by simply running out the clock.

---

## Contents

- [Quick start](#quick-start)
- [How to play](#how-to-play)
- [Controls](#controls)
- [Architecture](#architecture)
- [Scripts](#scripts)
- [Deployment](#deployment)
- [Environment variables](#environment-variables)
- [Testing](#testing)
- [What is implemented, and what is not](#what-is-implemented-and-what-is-not)
- [Tuning](#tuning)

---

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. That single process serves **both** the web client and the
realtime game server on /ws, so there is only one URL to share.

To play by yourself, open the game in three browser tabs (or on your phone at the same
address): the lobby needs **at least three players** to start, and up to **eight**.

```bash
npm run build && npm start   # production build, same single-port server
```

---

## How to play

### The loop

1. The host creates a lobby and shares the six-character code or the invite link (`/join/CODE`).
2. Everyone gets a **secret role card** during the 10-second reveal.
3. During the shift:
   - **Work Progress** fills as real jobs are completed. Staff win at 100%.
   - **Exposure** rises whenever a guest or the manager can see the elephant. It decays
     slowly when nobody has seen it for a few seconds. Saboteurs win at 100%.
   - At 25%, 50% and 75% exposure the elephant **grows**: bigger, faster, harder to hide.
   - The shift timer running out is also a Saboteur win.
4. The results screen reveals every role, every real sabotage, and the funniest incidents
   of the round. The host can start another round without re-inviting anyone.

### Hiding the elephant (this is the game)

Exposure is not automatic - it depends on **line of sight**, so there is real counterplay:

- **Close doors.** Room 101, Room 102 and the front doors block sight lines. An elephant
  inside a room with its door shut and no guest inside is genuinely hidden.
- **Stand in the way.** An employee close to the elephant gives "crowd cover" and cuts the
  exposure rate by more than half.
- **Calm it.** The Animal Whisperer can settle it for 20 seconds.
- **Lure it.** Elephant Bait (a Saboteur tool) and the elephant's own hunger pull it away
  from guests.
- **Redirect guests.** The Manager changes the inspection route or calls an inspection
  somewhere harmless.
- **Mop up.** Spills stay on the floor and people slip on them, which is funny but costs
  time and makes a noise.

### Roles

| Role | Team | Power |
| --- | --- | --- |
| Ordinary Employee | Staff | No powers. Watch everyone. |
| Sheriff | Staff | One arrest per match. Correct = the Saboteur's tools go offline for 30s. Wrong = a public scene and +22% exposure. |
| Detective | Staff | Inspect a damaged object for a partial clue (a real name plus a decoy who was nearby). |
| Mechanic | Staff | Diagnose and instantly repair tampered equipment. |
| Animal Whisperer | Staff | Calm the elephant when close to it. |
| Janitor | Staff | Instantly deep-clean every nearby spill - and be remembered for it. |
| Manager | Staff | One emergency inspection that sends every guest to a chosen spot. |
| Saboteur | Imposters | Fake jobs, seven sabotage tools, one or two per match. |

### Sabotage tools

Loose Wheel (wreck a trolley: whoever touches it next takes the blame) · Elephant Bait ·
Wrong Room · Power Outage · Supply Swap · Fake Spill · Open Doors.

Most of them require the Saboteur to **stand next to the target**, and they leave evidence
that other players can see - so sabotage means risk, not remote disaster buttons.

### Accusations

No one is ever killed or removed. Instead there is one **Staff Investigation** per match:
anyone can call it, everyone votes, and the outcome is public. A correct vote seizes the
imposter's equipment for 60 seconds. A wrong vote hands the elephant the perfect cover.

---

## Controls

| | Phone (landscape) | Desktop |
| --- | --- | --- |
| Move | Hold and drag anywhere on the left half | `W A S D` / arrow keys |
| Interact / do a job | **Use** button (bottom right) | `E` or `Space` |
| Role ability | Ability button (bottom right) | `Q` |
| Emote | Emote row (bottom left) | Emote row |
| Sabotage panel | 😈 Sabotage (Saboteurs only) | Same |
| Task minigame | Tap to select, tap to place; drag for the mop | Mouse |

Turn the phone sideways: the hotel is wider than it is tall, and the game shows a
"rotate your device" screen in portrait.

---

## Architecture

```
app/            Next.js App Router pages (menu, /join/[code])
components/     React UI: menu, lobby, canvas renderer, HUD, minigames, overlays
game/           Shared, data-driven content + protocol used by BOTH sides
  config.ts       tuning constants (speeds, meters, timers)
  content.ts      hotel layout, stations, tasks, roles, sabotages, incidents, modifiers
  map.ts          collision, line of sight, pathfinding
  protocol.ts     the client/server message contract
server/         Authoritative game server (Node + ws)
  room.ts         the match: phases, roles, tasks, sabotage, votes, win conditions
  elephant.ts     elephant state machine
  guests.ts       guest AI, spotting and exposure
  incidents.ts    12 hotel incidents
  tasks.ts        puzzle generation AND answer validation
main.ts         one process: Next.js + the game socket (dev and Docker)
```

Key decisions:

- **The server decides everything that matters.** Roles, task assignment, puzzle answers,
  sabotage cooldowns and limits, exposure, work progress, votes and winners are all
  resolved server-side. Clients send intents and render snapshots (10 per second, with
  interpolation and light client-side prediction for your own movement).
- **`ws` instead of Colyseus, and a hand-written canvas renderer instead of Phaser.**  The brief lists those as the preferred stack. Colyseus and Phaser are both fine choices, but
  for this game a small explicit server (plain TypeScript, no game framework) and a canvas
  renderer that bakes the static hotel into one offscreen image were easier to keep correct
  and much lighter on phones. The multiplayer is genuine either way - real sockets, real server
  authority, real reconnection. Swapping in Colyseus later means porting `Room`; the wire
  protocol in `game/protocol.ts` would not have to change shape.
- **Zero asset files.** Characters, the hotel, the furniture, the elephant and every sound
  effect are generated in code (canvas drawing plus Web Audio synthesis), so there is
  nothing to licence, download or keep in sync.
- **Data-driven content.** A new room, job, role, sabotage, incident or modifier is a new
  entry in `game/content.ts`.

---

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server **plus** the game server on one port (3000) |
| `npm run build` | Production Next.js build |
| `npm start` | Production all-in-one server |
| `npm run dev:web` | Next.js only (use with `dev:game` and `NEXT_PUBLIC_GAME_SERVER_URL`) |
| `npm run dev:game` / `npm run server` | Standalone game server only (port from `PORT`, default 3001) |
| `npm test` | Integration + simulation test suite (22 tests, real sockets) |
| `npm run probe` | Runtime probe against an already-running server (`node tests/probe.mjs http://localhost:3000`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

---

## Deployment

### Option A - one container (recommended, simplest)

The game needs a long-lived process for WebSockets, so a single container hosting both the
web client and the game server is the least moving parts. Any host that runs Docker and
allows WebSocket upgrades works (Render, Railway, Fly.io, a VPS).

```bash
docker build -t elephant-in-the-room .
docker run -p 3000:3000 elephant-in-the-room
```

`render.yaml` is included for a one-click Render deployment (`runtime: docker`). Note that
Render's free instance types sleep when idle and will drop sockets.

### Option B - Vercel for the client, the game server elsewhere

Vercel is a great host for the client but **cannot host the game server**: it does not keep
a Node process alive for WebSockets. Two deploys:

1. **Client on Vercel.** Import the repo, framework preset Next.js, defaults. Set one
   environment variable: `NEXT_PUBLIC_GAME_SERVER_URL` = your game server's public origin
   (for example `https://elephant-game.onrender.com`). The client converts it to `wss://`
   and appends `/ws`.
2. **Game server** on Render/Railway/Fly:
   - Build: `npm ci`
   - Start: `npm run server` (or `npx tsx server/standalone.ts`)
   - It exposes `/health` for platform health checks.

If you deploy both halves on the same origin (Option A), leave
`NEXT_PUBLIC_GAME_SERVER_URL` unset and the client will use the page's own origin.

---

## Environment variables

Copy `.env.example` to `.env` if you need to change anything. Everything is optional.

| Variable | Used by | Meaning |
| --- | --- | --- |
| `NEXT_PUBLIC_GAME_SERVER_URL` | Client | Where the game socket lives when it is not the page's own origin. Must be `https://` in production (converted to `wss://`). |
| `PORT` | Server | Port for the all-in-one server (default 3000) or the standalone game server (default 3001). |
| `HOSTNAME` | All-in-one server | Bind address, default `0.0.0.0`. |

No database, no accounts, no third-party API keys, no secrets.

---

## Testing

```bash
npm test
```

22 tests, all passing (about 15 seconds). They run the **real** server over real WebSocket
connections, plus deterministic simulation checks against a real `Room`:

- lobby codes, 3-player and 8-player starts, a ninth player refused, fewer than three cannot start
- one imposter at 3–6 players, two at 7–8, imposter teammates known only to each other,
  employees never receiving the sabotage panel, the Sheriff always present
- every one of the eight task kinds is solvable **from exactly what the player can see**
  (the test solves each puzzle from its visible data and the server validates it), and
  nonsense answers are rejected for all eight
- a job cannot be completed from the other side of the hotel, or suspiciously fast
- sabotage cooldowns and a limited number of uses; employees cannot sabotage at all
- the Sheriff's wrong arrest spikes exposure by ~22 and the arrest is public
- the staff investigation votes, resolves, and seizes a correct suspect's tools
- all three win conditions: work quota, 100% exposure, timer expiry
- movement is server-authoritative and never leaves a player standing inside geometry
- a disconnect pauses the shift below three players, and reconnecting restores your role
- guests spotting the elephant, a closed door genuinely hiding it, elephant growth at
  exposure thresholds, and the elephant never holding a doorway hostage
- every task station is reachable from the lobby (map connectivity)

`npm run probe` is a separate, dependency-free check you can point at any running
instance (local, Docker, or a deployed host). It connects three real clients, starts a
match and verifies that roles are dealt privately, snapshots stream, and movement is
server-authoritative. All eight checks pass against the local all-in-one server.

**Not covered by automation, and still to be checked by a human in a browser:**

- two real browsers (or phones) playing a full round together over the internet, and
  latency/feel of the touch controls on a real phone
- the visual result on real devices (the automated environment has no browser)

---

## What is implemented, and what is not

Rather than describe ambitions, here is the honest state of the build.

**Fully implemented and tested**

- Real online multiplayer over WebSockets, 3–8 players, join by code or link, no accounts
- Server-authoritative roles, tasks, sabotages, probing, meters and win conditions
- One polished hotel map: reception, two guest bedrooms, laundry, dining, corridor, supply
  cupboard and lobby entrance, with walls, doors, furniture, collision and connectivity
- All eight jobs with their own interactive minigame, nine stations and randomised
  assignments that avoid the elephant
- All seven roles and all seven sabotage tools, each server-validated
- The elephant: wander, raid food, sleep, block doorways, knock luggage, interrupt work,
  follow players, chase bait, calm down, trumpet - with growth stages and fairness timeouts
- Guest and manager AI on an inspection route, with line-of-sight spotting
- All 12 incidents and all 6 round modifiers
- Staff investigation with voting, sheriff arrests, reconnect within two minutes, pause and
  safe end when too many players leave, rematch without re-inviting
- Mobile landscape controls (virtual stick, big buttons, touch minigames) and desktop keys
- Synthesised sound for ~20 cues with a mute toggle, plus emote expressions

**Simplified or deliberately different**

- **Cooperative jobs** exist as a 2-player variant of luggage delivery (the station needs
  two people standing at it) rather than several distinct co-op minigames.
- **Guests** follow a route with pauses and rerouting; they are not a full behaviour tree
  (no guest-to-guest conversation, no queuing).
- **Chat** is emotes only - there is no voice or text chat. For a party game that usually
  means players are already on a call, but it is a real omission.
- **One map.** The hotel is finished; other locations (house party, wedding, supermarket)
  are content work on top of the same engine, not new systems.
- **No bots**, so you need three real players (or three tabs) to start.
- **Anti-cheat scope:** the server validates that a job is yours, that you were standing at
  the station, that real time passed, and that your answer is correct. It cannot stop a
  modified client from reading a puzzle and answering it automatically - every puzzle is
  visible information by design. Nothing about roles, exposure, work or wins is
  client-authoritative, so a modified client cannot make itself win.

---

## Tuning

Balance lives in `game/config.ts` (speeds, meter rates, growth thresholds, timers) and in
`game/content.ts` (cooldowns, incident weights, per-task seconds). The host can also change
shift length, work-per-player, elephant energy and incidents per lobby, and apply up to two
modifiers. The defaults were chosen for a 6-minute, 3–8 player round.
