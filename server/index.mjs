/**
 * Planning Poker server.
 *
 * A thin real-time relay: an HTTP server for the built client plus a
 * WebSocket endpoint at /ws. There is no database, no cache, no disk write —
 * room state exists only in this process's memory and is swept away once
 * everyone leaves.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

import { DECKS, DEFAULT_DECK } from './src/decks.mjs';
import {
  castVote,
  createRoom,
  ensureHost,
  everyoneVoted,
  getRoom,
  joinRoom,
  markDisconnected,
  normalizeCode,
  removePlayer,
  resetRound,
  reveal,
  roomCount,
  serializeRoom,
  setDeck,
  setStory,
  sweep,
} from './src/rooms.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '0.0.0.0';
const CLIENT_DIR = path.resolve(__dirname, '../client/dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
};

/* ------------------------------------------------------------------ HTTP -- */

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  });
  res.end(payload);
}

function serveStatic(req, res) {
  if (!fs.existsSync(CLIENT_DIR)) {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Planning Poker API is running. Start the client with `npm run dev`.\n');
    return;
  }

  const url = new URL(req.url ?? '/', 'http://localhost');
  const requested = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(CLIENT_DIR, requested);

  if (!filePath.startsWith(CLIENT_DIR)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(CLIENT_DIR, 'index.html');
  }
  if (!fs.existsSync(filePath)) {
    res.writeHead(404).end('Not found');
    return;
  }

  const ext = path.extname(filePath);
  const immutable = requested.startsWith('/assets/');
  res.writeHead(200, {
    'content-type': MIME[ext] ?? 'application/octet-stream',
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (url.pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, rooms: roomCount(), uptime: Math.round(process.uptime()) });
  }

  if (url.pathname === '/api/decks') {
    return sendJson(res, 200, { decks: Object.values(DECKS), defaultDeck: DEFAULT_DECK });
  }

  if (url.pathname === '/api/rooms' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 4096) req.destroy();
    });
    req.on('end', () => {
      let parsed = {};
      try {
        parsed = body ? JSON.parse(body) : {};
      } catch {
        return sendJson(res, 400, { error: 'Invalid JSON' });
      }
      const room = createRoom({ name: parsed.name, deckId: parsed.deckId });
      sendJson(res, 201, { id: room.id, name: room.name, deckId: room.deckId });
    });
    return undefined;
  }

  if (url.pathname.startsWith('/api/rooms/')) {
    const room = getRoom(url.pathname.split('/')[3] ?? '');
    if (!room) return sendJson(res, 404, { error: 'Room not found' });
    return sendJson(res, 200, {
      id: room.id,
      name: room.name,
      deckId: room.deckId,
      players: room.players.size,
    });
  }

  return serveStatic(req, res);
});

/* ------------------------------------------------------------- WebSocket -- */

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });

/** @type {Map<import('ws').WebSocket, {roomId: string, playerId: string}>} */
const sockets = new Map();

function send(ws, message) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
}

function broadcast(roomId, build) {
  for (const [ws, ctx] of sockets) {
    if (ctx.roomId !== roomId) continue;
    const message = typeof build === 'function' ? build(ctx.playerId) : build;
    if (message) send(ws, message);
  }
}

function pushState(room, extra = null) {
  broadcast(room.id, (viewerId) => ({ t: 'state', room: serializeRoom(room, viewerId), event: extra }));
}

function contextFor(ws) {
  const ctx = sockets.get(ws);
  if (!ctx) return null;
  const room = getRoom(ctx.roomId);
  if (!room) return null;
  const player = room.players.get(ctx.playerId);
  if (!player) return null;
  return { room, player };
}

function requireHost(room, player) {
  return room.hostId === player.id;
}

const handlers = {
  join(ws, msg) {
    const room = getRoom(msg.roomId);
    if (!room) {
      return send(ws, { t: 'error', code: 'no-room', message: 'That room has already ended.' });
    }
    // A socket only ever belongs to one room.
    const previous = sockets.get(ws);
    if (previous) {
      const prevRoom = getRoom(previous.roomId);
      if (prevRoom) {
        markDisconnected(prevRoom, previous.playerId);
        pushState(prevRoom);
      }
    }

    let joined;
    try {
      joined = joinRoom(room, {
        sessionId: msg.sessionId,
        name: msg.name,
        spectator: msg.spectator,
      });
    } catch (error) {
      return send(ws, { t: 'error', code: 'full', message: error.message });
    }

    sockets.set(ws, { roomId: room.id, playerId: joined.player.id });
    send(ws, {
      t: 'welcome',
      youId: joined.player.id,
      room: serializeRoom(room, joined.player.id),
    });
    if (!joined.rejoined) {
      pushState(room, { kind: 'joined', name: joined.player.name, hue: joined.player.hue });
    } else {
      pushState(room);
    }
    return undefined;
  },

  vote(ws, msg) {
    const ctx = contextFor(ws);
    if (!ctx) return;
    if (!castVote(ctx.room, ctx.player.id, msg.value ?? null)) {
      return pushState(ctx.room);
    }
    if (ctx.room.autoReveal && everyoneVoted(ctx.room)) {
      reveal(ctx.room);
      return pushState(ctx.room, { kind: 'revealed', auto: true });
    }
    return pushState(ctx.room);
  },

  reveal(ws) {
    const ctx = contextFor(ws);
    if (!ctx || !requireHost(ctx.room, ctx.player)) return;
    if (reveal(ctx.room)) pushState(ctx.room, { kind: 'revealed', by: ctx.player.name });
  },

  reset(ws) {
    const ctx = contextFor(ws);
    if (!ctx || !requireHost(ctx.room, ctx.player)) return;
    resetRound(ctx.room);
    pushState(ctx.room, { kind: 'reset', by: ctx.player.name });
  },

  story(ws, msg) {
    const ctx = contextFor(ws);
    if (!ctx || !requireHost(ctx.room, ctx.player)) return;
    setStory(ctx.room, msg.title);
    pushState(ctx.room);
  },

  deck(ws, msg) {
    const ctx = contextFor(ws);
    if (!ctx || !requireHost(ctx.room, ctx.player)) return;
    if (setDeck(ctx.room, msg.deckId)) {
      pushState(ctx.room, { kind: 'deck', name: DECKS[ctx.room.deckId]?.name });
    }
  },

  autoReveal(ws, msg) {
    const ctx = contextFor(ws);
    if (!ctx || !requireHost(ctx.room, ctx.player)) return;
    ctx.room.autoReveal = Boolean(msg.value);
    if (ctx.room.autoReveal && everyoneVoted(ctx.room) && !ctx.room.revealed) {
      reveal(ctx.room);
      return pushState(ctx.room, { kind: 'revealed', auto: true });
    }
    return pushState(ctx.room);
  },

  spectator(ws, msg) {
    const ctx = contextFor(ws);
    if (!ctx) return;
    ctx.player.spectator = Boolean(msg.value);
    if (ctx.player.spectator) {
      ctx.player.vote = null;
      ctx.player.votedAt = null;
    }
    if (ctx.room.autoReveal && everyoneVoted(ctx.room) && !ctx.room.revealed) {
      reveal(ctx.room);
      return pushState(ctx.room, { kind: 'revealed', auto: true });
    }
    return pushState(ctx.room);
  },

  rename(ws, msg) {
    const ctx = contextFor(ws);
    if (!ctx) return;
    const next = String(msg.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 24);
    if (!next) return;
    ctx.player.name = next;
    pushState(ctx.room);
  },

  transferHost(ws, msg) {
    const ctx = contextFor(ws);
    if (!ctx || !requireHost(ctx.room, ctx.player)) return;
    const target = ctx.room.players.get(String(msg.playerId ?? ''));
    if (!target || !target.connected) return;
    ctx.room.hostId = target.id;
    pushState(ctx.room, { kind: 'host', name: target.name });
  },

  kick(ws, msg) {
    const ctx = contextFor(ws);
    if (!ctx || !requireHost(ctx.room, ctx.player)) return;
    const targetId = String(msg.playerId ?? '');
    if (targetId === ctx.player.id) return;
    const removed = removePlayer(ctx.room, targetId);
    if (!removed) return;
    for (const [socket, meta] of sockets) {
      if (meta.roomId === ctx.room.id && meta.playerId === targetId) {
        send(socket, { t: 'error', code: 'kicked', message: 'You were removed from the room.' });
        sockets.delete(socket);
        socket.close(4003, 'kicked');
      }
    }
    pushState(ctx.room, { kind: 'left', name: removed.name, kicked: true });
  },

  emote(ws, msg) {
    const ctx = contextFor(ws);
    if (!ctx) return;
    const allowed = ['👍', '🎉', '🤔', '😂', '🔥', '☕', '👀', '🙌'];
    if (!allowed.includes(msg.emoji)) return;
    broadcast(ctx.room.id, { t: 'emote', emoji: msg.emoji, from: ctx.player.id, name: ctx.player.name });
  },

  leave(ws) {
    const ctx = contextFor(ws);
    if (!ctx) return;
    const room = ctx.room;
    const removed = removePlayer(room, ctx.player.id);
    sockets.delete(ws);
    if (removed) pushState(room, { kind: 'left', name: removed.name });
  },

  ping(ws) {
    send(ws, { t: 'pong', now: Date.now() });
  },
};

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return send(ws, { t: 'error', code: 'bad-json', message: 'Malformed message.' });
    }
    const handler = handlers[msg?.t];
    if (!handler) return send(ws, { t: 'error', code: 'unknown', message: `Unknown action: ${msg?.t}` });
    try {
      return handler(ws, msg);
    } catch (error) {
      console.error('[ws] handler failed', msg?.t, error);
      return send(ws, { t: 'error', code: 'server', message: 'Something went wrong.' });
    }
  });

  ws.on('close', () => {
    const ctx = sockets.get(ws);
    sockets.delete(ws);
    if (!ctx) return;
    const room = getRoom(ctx.roomId);
    if (!room) return;
    markDisconnected(room, ctx.playerId);
    ensureHost(room);
    pushState(room);
  });

  ws.on('error', () => ws.terminate());
});

/* --------------------------------------------------------------- Upkeep -- */

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 30_000);

const janitor = setInterval(() => {
  const { players, rooms: dropped } = sweep();
  for (const { roomId, player } of players) {
    const room = getRoom(roomId);
    if (room) pushState(room, { kind: 'left', name: player.name });
  }
  if (dropped.length) console.log(`[sweep] released ${dropped.length} idle room(s)`);
}, 10_000);

heartbeat.unref?.();
janitor.unref?.();

function shutdown() {
  clearInterval(heartbeat);
  clearInterval(janitor);
  for (const ws of wss.clients) ws.close(1001, 'server shutting down');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.listen(PORT, HOST, () => {
  console.log(`\n  ♠ Planning Poker server ready on http://localhost:${PORT}`);
  console.log(`    ws://localhost:${PORT}/ws  ·  rooms are in-memory only\n`);
});

export { server, wss, normalizeCode };
