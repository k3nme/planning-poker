<div align="center">

# ♠ Planning Poker

**Real-time story estimation for teams. No accounts, no database, nothing stored.**

Rooms live in the server's memory and are swept away a few minutes after the
last person leaves. There is no disk write anywhere in the stack.

</div>

---

## What it does

- **Rooms in one click** — create a room, share the six-character code or the
  invite link. Anyone with the link takes a seat immediately.
- **Secret voting** — hidden votes never leave the server. Until the reveal,
  other players' cards are stripped from the payload entirely, so there is
  nothing to peek at in devtools.
- **Reveal together** — cards flip in a staggered 3D turn. Unanimous rounds get
  a confetti burst.
- **Live stats** — average, median, spread, distribution and the closest card
  on the deck, plus a rolling history of the last twelve rounds.
- **Five decks** — Fibonacci, modified Fibonacci, t-shirt sizes, powers of two
  and plain sequential. The host can switch mid-session.
- **Host controls** — set the story, reveal, start the next round, promote
  another host, remove someone. The host role moves automatically if they drop.
- **Observers** — join without a vote; observers are skipped by the round.
- **Reactions** — six emoji that float up the screen for everyone.
- **Reconnect-safe** — refresh the page and you keep your seat and your vote.
- **Dark and light themes**, full keyboard control, and `prefers-reduced-motion`
  honoured throughout.

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

## Keyboard

| Key | Action |
| --- | --- |
| `1`–`9`, `0` | Play the card at that position |
| `Esc` | Take your card back |
| `Space` | Reveal the round (host) |
| `N` | Deal the next round (host) |

## How it is put together

```
server/
  index.mjs        HTTP + WebSocket entry point, static file serving
  src/rooms.mjs    the in-memory room store, vote logic and statistics
  src/decks.mjs    deck definitions
client/
  src/lib/         socket hook, session helpers, confetti, formatting
  src/components/  landing page, table, seats, hand, console, side rail
  src/styles/      design tokens and component styles
```

The client keeps no state of its own: every action is a message to the server,
and every render comes from the room snapshot the server pushes back. That
snapshot is serialized **per viewer**, which is what keeps hidden votes hidden.

### Wire protocol

Client → server: `join`, `vote`, `reveal`, `reset`, `story`, `deck`,
`autoReveal`, `spectator`, `rename`, `transferHost`, `kick`, `emote`, `leave`,
`ping`.

Server → client: `welcome`, `state`, `emote`, `error`, `pong`.

### HTTP endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness plus the current room count |
| `GET` | `/api/decks` | Deck definitions |
| `POST` | `/api/rooms` | Create a room, returns its code |
| `GET` | `/api/rooms/:code` | Check that a code is still live |

## About "nothing stored"

The server holds rooms in a `Map` and nowhere else — no database, no cache, no
files. A sweeper runs every ten seconds and:

- drops players who have been disconnected for more than 25 seconds,
- deletes rooms with nobody connected for five minutes,
- deletes any room older than twelve hours.

Restart the process and every room is gone.

The browser keeps three things in its own storage, and never sends them
anywhere else: your display name and theme in `localStorage`, and a random
per-tab id in `sessionStorage` so a refresh can reclaim your seat.

## Limits

40 people per room, 24-character names, 140-character story titles, and a
16 KB cap on socket payloads.
