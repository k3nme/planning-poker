/**
 * In-memory room store.
 *
 * Nothing here touches a disk or a database on purpose: every room lives in
 * this Map, and once the last person leaves (plus a short grace period so a
 * page refresh doesn't nuke the session) it is garbage collected forever.
 */

import { randomUUID } from 'node:crypto';
import { DEFAULT_DECK, getDeck, isValidCard, numericValue } from './decks.mjs';

/** Unambiguous alphabet — no 0/O, 1/I/L, so codes survive being read aloud. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

/** How long a disconnected player keeps their seat before being dropped. */
export const RECONNECT_GRACE_MS = 25_000;
/** How long an empty room lingers before it is deleted. */
export const EMPTY_ROOM_TTL_MS = 5 * 60_000;
/** Hard ceiling so a forgotten tab can't pin a room forever. */
export const MAX_ROOM_AGE_MS = 12 * 60 * 60_000;

const MAX_PLAYERS = 40;
const MAX_NAME = 24;
const MAX_STORY = 140;

/** @type {Map<string, Room>} */
const rooms = new Map();

const AVATAR_HUES = [268, 199, 330, 152, 24, 45, 288, 178, 12, 220, 100, 315];

function makeCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export function normalizeCode(input) {
  return String(input ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);
}

function cleanName(input, fallback = 'Guest') {
  const name = String(input ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
  return name || fallback;
}

function cleanStory(input) {
  return String(input ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_STORY);
}

export function createRoom({ name, deckId = DEFAULT_DECK } = {}) {
  let id = makeCode();
  while (rooms.has(id)) id = makeCode();

  const room = {
    id,
    name: cleanName(name, 'Sprint planning'),
    deckId: getDeck(deckId).id,
    story: '',
    revealed: false,
    autoReveal: true,
    round: 1,
    roundStartedAt: Date.now(),
    revealedAt: null,
    createdAt: Date.now(),
    emptySince: null,
    hostId: null,
    /** @type {Map<string, Player>} */
    players: new Map(),
    history: [],
  };
  rooms.set(id, room);
  return room;
}

export function getRoom(id) {
  return rooms.get(normalizeCode(id)) ?? null;
}

export function roomCount() {
  return rooms.size;
}

export function joinRoom(room, { sessionId, name, spectator = false }) {
  const existing = sessionId ? room.players.get(sessionId) : null;

  if (existing) {
    existing.connected = true;
    existing.disconnectedAt = null;
    existing.name = cleanName(name, existing.name);
    if (typeof spectator === 'boolean') existing.spectator = spectator;
    ensureHost(room);
    return { player: existing, rejoined: true };
  }

  if (room.players.size >= MAX_PLAYERS) {
    throw new Error('This room is full (40 people max).');
  }

  const player = {
    id: sessionId && /^[\w-]{6,64}$/.test(sessionId) ? sessionId : randomUUID(),
    name: cleanName(name),
    hue: AVATAR_HUES[room.players.size % AVATAR_HUES.length],
    vote: null,
    votedAt: null,
    spectator: Boolean(spectator),
    connected: true,
    disconnectedAt: null,
    joinedAt: Date.now(),
  };

  room.players.set(player.id, player);
  room.emptySince = null;
  ensureHost(room);
  return { player, rejoined: false };
}

/** The host is whoever has been connected longest; it moves on automatically. */
export function ensureHost(room) {
  const current = room.hostId ? room.players.get(room.hostId) : null;
  if (current && current.connected) return;

  const candidate = [...room.players.values()]
    .filter((p) => p.connected)
    .sort((a, b) => a.joinedAt - b.joinedAt)[0];

  room.hostId = candidate ? candidate.id : room.hostId;
}

export function markDisconnected(room, playerId) {
  const player = room.players.get(playerId);
  if (!player) return;
  player.connected = false;
  player.disconnectedAt = Date.now();
  ensureHost(room);
  if (![...room.players.values()].some((p) => p.connected)) {
    room.emptySince = Date.now();
  }
}

export function removePlayer(room, playerId) {
  const player = room.players.get(playerId);
  room.players.delete(playerId);
  ensureHost(room);
  if (![...room.players.values()].some((p) => p.connected)) {
    room.emptySince = Date.now();
  }
  return player ?? null;
}

export function castVote(room, playerId, value) {
  const player = room.players.get(playerId);
  if (!player || player.spectator) return false;
  if (room.revealed) return false;

  if (value === null || player.vote === value) {
    player.vote = null;
    player.votedAt = null;
    return true;
  }
  if (!isValidCard(room.deckId, value)) return false;

  player.vote = value;
  player.votedAt = Date.now();
  return true;
}

export function everyoneVoted(room) {
  const voters = [...room.players.values()].filter((p) => !p.spectator && p.connected);
  return voters.length > 0 && voters.every((p) => p.vote !== null);
}

export function reveal(room) {
  if (room.revealed) return false;
  room.revealed = true;
  room.revealedAt = Date.now();
  const stats = computeStats(room);
  room.history.unshift({
    round: room.round,
    story: room.story,
    endedAt: room.revealedAt,
    average: stats.average,
    consensus: stats.consensus,
    votes: stats.distribution,
  });
  room.history = room.history.slice(0, 12);
  return true;
}

export function resetRound(room) {
  room.revealed = false;
  room.revealedAt = null;
  room.round += 1;
  room.roundStartedAt = Date.now();
  for (const player of room.players.values()) {
    player.vote = null;
    player.votedAt = null;
  }
}

export function setStory(room, title) {
  room.story = cleanStory(title);
}

export function setDeck(room, deckId) {
  const deck = getDeck(deckId);
  if (deck.id === room.deckId) return false;
  room.deckId = deck.id;
  // Votes from the previous deck are meaningless now.
  for (const player of room.players.values()) {
    player.vote = null;
    player.votedAt = null;
  }
  room.revealed = false;
  room.revealedAt = null;
  return true;
}

export function computeStats(room) {
  const voters = [...room.players.values()].filter((p) => !p.spectator && p.vote !== null);
  const distribution = [];
  const counts = new Map();

  for (const p of voters) {
    counts.set(p.vote, (counts.get(p.vote) ?? 0) + 1);
  }
  const order = getDeck(room.deckId).cards.map((c) => c.value);
  for (const [value, count] of counts) {
    distribution.push({ value, count, order: order.indexOf(value) });
  }
  distribution.sort((a, b) => a.order - b.order);

  const numbers = voters
    .map((p) => numericValue(room.deckId, p.vote))
    .filter((n) => typeof n === 'number' && Number.isFinite(n))
    .sort((a, b) => a - b);

  const average = numbers.length
    ? Math.round((numbers.reduce((sum, n) => sum + n, 0) / numbers.length) * 100) / 100
    : null;

  let median = null;
  if (numbers.length) {
    const mid = Math.floor(numbers.length / 2);
    median = numbers.length % 2 ? numbers[mid] : (numbers[mid - 1] + numbers[mid]) / 2;
    median = Math.round(median * 100) / 100;
  }

  const consensus = voters.length > 1 && counts.size === 1;
  const spread = numbers.length ? { min: numbers[0], max: numbers[numbers.length - 1] } : null;

  // The card closest to the average — a sane "suggested" estimate.
  let suggestion = null;
  if (average !== null) {
    let best = null;
    for (const c of getDeck(room.deckId).cards) {
      if (typeof c.numeric !== 'number') continue;
      const delta = Math.abs(c.numeric - average);
      if (!best || delta < best.delta) best = { value: c.value, delta };
    }
    suggestion = best ? best.value : null;
  }

  return {
    average,
    median,
    consensus,
    spread,
    suggestion,
    voterCount: voters.length,
    distribution: distribution.map(({ value, count }) => ({ value, count })),
  };
}

/**
 * Serialize for a specific viewer: other people's votes stay secret until the
 * reveal, so the hidden values never even reach the browser.
 */
export function serializeRoom(room, viewerId) {
  const players = [...room.players.values()]
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((p) => ({
      id: p.id,
      name: p.name,
      hue: p.hue,
      spectator: p.spectator,
      connected: p.connected,
      isHost: p.id === room.hostId,
      hasVoted: p.vote !== null,
      vote: room.revealed || p.id === viewerId ? p.vote : null,
    }));

  return {
    id: room.id,
    name: room.name,
    deckId: room.deckId,
    story: room.story,
    revealed: room.revealed,
    autoReveal: room.autoReveal,
    round: room.round,
    roundStartedAt: room.roundStartedAt,
    revealedAt: room.revealedAt,
    hostId: room.hostId,
    players,
    stats: room.revealed ? computeStats(room) : null,
    history: room.history,
  };
}

/** Periodic sweep — the only thing standing between us and a memory leak. */
export function sweep(now = Date.now()) {
  const removed = { players: [], rooms: [] };

  for (const room of rooms.values()) {
    for (const player of [...room.players.values()]) {
      if (!player.connected && player.disconnectedAt && now - player.disconnectedAt > RECONNECT_GRACE_MS) {
        room.players.delete(player.id);
        removed.players.push({ roomId: room.id, player });
      }
    }
    ensureHost(room);

    const empty = ![...room.players.values()].some((p) => p.connected);
    if (empty && !room.emptySince) room.emptySince = now;
    if (!empty) room.emptySince = null;

    const expired =
      (room.emptySince && now - room.emptySince > EMPTY_ROOM_TTL_MS) ||
      now - room.createdAt > MAX_ROOM_AGE_MS;

    if (expired) {
      rooms.delete(room.id);
      removed.rooms.push(room.id);
    }
  }

  return removed;
}

export const __testing = { rooms };
