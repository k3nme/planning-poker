<div align="center">

# ♠ Planning Poker

**Planning poker — and every other scrum ceremony — in one real-time room.
No accounts, no database, nothing stored.**

Rooms live in the server's memory and are swept away a few minutes after the
last person leaves. There is no disk write anywhere in the stack.

</div>

---

## The ceremonies

One room, one set of participants, six boards the host switches between. Everyone
follows the host, so a distributed team is always looking at the same thing.

### 🃏 Estimate — planning poker
Secret voting, a staggered 3D reveal, confetti on a unanimous round. Average,
median, spread, distribution and the closest card on the deck. Six decks:
Fibonacci, modified Fibonacci, t-shirt sizes, powers of two, sequential, and
fist-of-five for confidence votes.

### 📋 Backlog — refinement
An ordered list of stories with status and estimate. **Estimate** hands a story
to the poker table, and the agreed card is written straight back onto the row.
Carries the Definition of Done checklist and a parking lot.

### ☀ Standup — daily scrum
A shuffled round robin with a per-person timebox, a countdown ring that turns red
when someone runs over, and the three prompts on screen. Separate blocker and
parking-lot lists so tangents get captured instead of eating the meeting.

### 🔁 Retro — retrospective
Five board templates (Went well / To improve, Start-Stop-Continue, Four Ls,
Mad-Sad-Glad, Sailboat) and four phases:

1. **Collect** — everyone writes privately. Other people's cards arrive from the
   server with their text stripped, so the board genuinely cannot be read early.
2. **Discuss** — all cards turn over at once.
3. **Vote** — dot voting with a per-person budget.
4. **Actions** — top-voted cards, promoted into an owned action list.

Cards can be anonymous or named, at the host's choice.

### 🎬 Review — sprint review
A demo agenda with a presenter per item, tick-off as each is shown, thumbs-up
counts, and a feedback list that survives into the action items.

### 💓 Health — team health check
Eight squad-health dimensions rated good / mixed / poor. Answers stay on the
server until the host reveals them, so nobody anchors on the first response.
Results come back as stacked bars with a percentage per dimension.

### Everywhere
- **Sprint goal** and a shared **timebox** above every board.
- **Action items** carried across ceremonies.
- Emoji reactions, join/leave toasts, host controls, observers.
- **Reconnect-safe** — refresh and you keep your seat, your vote and your cards.
- Dark and light themes, keyboard voting, `prefers-reduced-motion` honoured.

## Host controls

The host drives the room: switching ceremony, revealing, dealing the next round,
setting the sprint goal and timebox, changing decks and retro templates, running
the standup rota, promoting another host and removing people. The role hands over
automatically if the host drops.

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. The Vite dev server proxies `/api` and `/ws` to
the API on port `8787`.

### Production

```bash
npm run build   # builds the client into client/dist
npm start       # one Node process serves the client, the API and the socket
```

Then open <http://localhost:8787>. Set `PORT` to serve somewhere else.

## Deploying

**This app needs a host that runs a long-lived Node process.** Rooms live in
that process's memory and clients hold open WebSocket connections to it, so it
cannot run on serverless platforms — Vercel, Netlify Functions, Cloudflare
Workers and friends have no inbound WebSocket support and no memory shared
between invocations. Deploying there gives you a UI that loads and then reports
*"Could not reach the server"*, because `/api/rooms` does not exist.

### Render (blueprint included)

`render.yaml` is in the repo. In the Render dashboard: **New → Blueprint →
select this repo**. It provisions one free web service that serves the client,
the API and the WebSocket from a single origin:

| Setting | Value |
| --- | --- |
| Build | `npm ci --include=dev && npm run build` |
| Start | `npm start` |
| Health check | `/api/health` |

`--include=dev` matters: the client build needs Vite and TypeScript, which a
plain `npm ci` skips once `NODE_ENV=production`.

Two things to know about the free tier. It sleeps after 15 minutes with no
traffic and takes 30–60 seconds to wake, so the first person into a room after a
quiet spell waits — an active meeting keeps it warm. And a sleep or a redeploy
drops every room, which is the same guarantee the app already makes.

### Anywhere else

`npm start` is the whole contract: serve the repo with Node ≥ 20 and set `PORT`.
Railway and Fly.io work with the same two commands.

A `Dockerfile` is included for container hosts (Fly, Railway, Koyeb, Cloud Run,
a plain VPS) — a multi-stage build that ships the server plus the built client
and only the one runtime dependency.

## Keyboard

| Key | Action |
| --- | --- |
| `1`–`9`, `0` | Play the card at that position |
| `Esc` | Take your card back |
| `Space` | Reveal the round (host) |
| `N` | Deal the next round (host) |
| `Enter` | Add a card; `Shift+Enter` for a new line |
| `Esc` | Close the settings sheet |

## How it is put together

```
server/
  index.mjs           HTTP + WebSocket entry point, static file serving
  src/rooms.mjs       in-memory room store, item store, ceremony logic, stats
  src/decks.mjs       deck definitions
  src/templates.mjs   retro layouts, health dimensions, standup prompts, DoD
client/
  src/lib/            socket hook, templates, session, confetti, formatting
  src/components/     room shell, activity bar, timebox, shared sticky cards
  src/components/stages/  one component per ceremony
  src/styles/         design tokens and component styles
```

Most boards are the same thing wearing different clothes: a single generic item
store on the server backs the backlog, retro board, review agenda, action items,
parking lot and Definition of Done. Each item has a column, votes, a done flag
and a small `meta` bag for the per-list extras (an estimate, a presenter, an
owner). That is why six ceremonies did not cost six data models.

The client keeps no state of its own: every action is a message to the server,
and every render comes from the room snapshot the server pushes back. That
snapshot is serialized **per viewer**, which is what keeps hidden votes hidden.

### Wire protocol

Client → server:

- **Room** — `join`, `rename`, `spectator`, `transferHost`, `kick`, `emote`,
  `leave`, `ping`
- **Poker** — `vote`, `reveal`, `reset`, `story`, `deck`, `autoReveal`
- **Ceremony** — `activity`, `sprintGoal`, `timerStart`, `timerStop`
- **Items** — `itemAdd`, `itemUpdate`, `itemRemove`, `itemReorder`, `itemVote`
- **Retro** — `retroTemplate`, `retroPhase`, `retroSettings`
- **Standup** — `standupStart`, `standupNext`, `standupStop`
- **Health** — `healthVote`, `healthReveal`, `healthReset`
- **Backlog ↔ poker** — `estimateItem`, `recordEstimate`

Server → client: `welcome`, `state`, `emote`, `error`, `pong`.

### HTTP endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness plus the current room count |
| `GET` | `/api/decks` | Deck definitions |
| `GET` | `/api/templates` | Activities, retro layouts, health dimensions |
| `POST` | `/api/rooms` | Create a room, returns its code |
| `GET` | `/api/rooms/:code` | Check that a code is still live |

## About "nothing stored"

The server holds rooms in a `Map` and nowhere else — no database, no cache, no
files. A sweeper runs every ten seconds and:

- drops players who have been disconnected for more than 25 seconds (and takes
  them out of the standup rota and the health results),
- deletes rooms with nobody connected for five minutes,
- deletes any room older than twelve hours.

Restart the process and every room is gone.

The browser keeps three things in its own storage, and never sends them
anywhere else: your display name and theme in `localStorage`, and a random
per-tab id in `sessionStorage` so a refresh can reclaim your seat.

## Permissions

The host runs the room. Everyone can add cards, vote and react. Your own cards
are yours to edit or delete; anything else needs the host. Non-host messages that
try to drive the room are ignored server-side, not just hidden in the UI.

## Limits

40 people per room, 24-character names, 140-character story titles, 280-character
cards, 200 items per list, and a 16 KB cap on socket payloads.
