/**
 * In-memory room store.
 *
 * Nothing here touches a disk or a database on purpose: every room lives in
 * this Map, and once the last person leaves (plus a short grace period so a
 * page refresh doesn't nuke the session) it is garbage collected forever.
 */

import { randomUUID } from 'node:crypto';
import { DEFAULT_DECK, getDeck, isValidCard, numericValue } from './decks.mjs';
import {
  ACTIVITY_IDS,
  DEFAULT_DOD,
  DEFAULT_RETRO_TEMPLATE,
  getRetroTemplate,
  HEALTH_DIMENSIONS,
  HEALTH_LEVELS,
  LIST_NAMES,
  STANDUP_PROMPTS,
} from './templates.mjs';

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
const MAX_ITEM_TEXT = 280;
const MAX_ITEMS_PER_LIST = 200;
const RETRO_PHASES = ['collect', 'reveal', 'vote', 'act'];

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

    /* --- the ceremony the room is currently running --- */
    activity: 'poker',
    sprintGoal: '',

    /* A countdown any ceremony can borrow. */
    timer: { label: '', endsAt: null, duration: 0 },

    /**
     * One generic store behind the backlog, retro board, review agenda,
     * action items, parking lot and Definition of Done. Same item shape
     * everywhere; only the UI arranging them differs.
     */
    lists: Object.fromEntries(LIST_NAMES.map((name) => [name, []])),

    retro: {
      template: DEFAULT_RETRO_TEMPLATE,
      phase: 'collect',
      votesPerPerson: 3,
      anonymous: true,
    },

    standup: {
      order: [],
      index: 0,
      perPerson: 90,
      turnStartedAt: null,
      running: false,
      finished: [],
    },

    health: { revealed: false, votes: {} },

    /** Set while a poker round is estimating a specific backlog item. */
    backlogRef: null,
  };

  for (const text of DEFAULT_DOD) {
    room.lists.dod.push(makeItem({ text, authorId: null, authorName: 'Team' }));
  }
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

/** Drop someone from the standup rota without losing the current speaker. */
export function pruneStandup(room, playerId) {
  const { standup } = room;
  const index = standup.order.indexOf(playerId);
  if (index === -1) return;
  standup.order.splice(index, 1);
  standup.finished = standup.finished.filter((id) => id !== playerId);
  if (index < standup.index) standup.index -= 1;
  if (standup.index >= standup.order.length) {
    standup.index = Math.max(0, standup.order.length - 1);
    if (standup.order.length === 0) standup.running = false;
  }
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
  pruneStandup(room, playerId);
  delete room.health.votes[playerId];
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

/* ------------------------------------------------------------ Items ----- */

function cleanText(input, max = MAX_ITEM_TEXT) {
  return String(input ?? '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
}

/**
 * The one item shape used by every list. `meta` carries the per-list extras:
 * an estimate and status on the backlog, a presenter on the review agenda,
 * an owner on an action item.
 */
export function makeItem({ text, authorId, authorName, column = 'default', meta = {} }) {
  return {
    id: randomUUID(),
    text: cleanText(text),
    authorId: authorId ?? null,
    authorName: authorName ?? 'Someone',
    column,
    votes: {},
    done: false,
    meta,
    createdAt: Date.now(),
  };
}

const listOf = (room, list) => (LIST_NAMES.includes(list) ? room.lists[list] : null);

export function addItem(room, list, payload) {
  const target = listOf(room, list);
  if (!target || target.length >= MAX_ITEMS_PER_LIST) return null;
  const text = cleanText(payload.text);
  if (!text) return null;
  const item = makeItem({ ...payload, text });
  target.push(item);
  return item;
}

export function updateItem(room, list, itemId, patch) {
  const item = listOf(room, list)?.find((entry) => entry.id === itemId);
  if (!item) return null;
  if (typeof patch.text === 'string') {
    const text = cleanText(patch.text);
    if (text) item.text = text;
  }
  if (typeof patch.column === 'string') item.column = patch.column.slice(0, 40);
  if (typeof patch.done === 'boolean') item.done = patch.done;
  if (patch.meta && typeof patch.meta === 'object') {
    for (const [key, value] of Object.entries(patch.meta)) {
      item.meta[key] = typeof value === 'string' ? value.slice(0, 120) : value;
    }
  }
  return item;
}

export function removeItem(room, list, itemId) {
  const target = listOf(room, list);
  if (!target) return false;
  const index = target.findIndex((entry) => entry.id === itemId);
  if (index === -1) return false;
  target.splice(index, 1);
  return true;
}

/** Move an item to a new index within its list (drag to reorder). */
export function reorderItem(room, list, itemId, toIndex) {
  const target = listOf(room, list);
  if (!target) return false;
  const from = target.findIndex((entry) => entry.id === itemId);
  if (from === -1) return false;
  const to = Math.max(0, Math.min(target.length - 1, Number(toIndex) || 0));
  const [item] = target.splice(from, 1);
  target.splice(to, 0, item);
  return true;
}

/**
 * Dot voting. Each voter has a budget per list; clicking again removes a dot,
 * so a person can pile several onto one card up to the budget.
 */
export function voteItem(room, list, itemId, playerId, delta) {
  const target = listOf(room, list);
  if (!target) return false;
  const item = target.find((entry) => entry.id === itemId);
  if (!item) return false;

  const budget = list === 'retro' ? room.retro.votesPerPerson : 99;
  const spent = target.reduce((total, entry) => total + (entry.votes[playerId] ?? 0), 0);
  const current = item.votes[playerId] ?? 0;
  const next = current + (delta >= 0 ? 1 : -1);

  if (next < 0) return false;
  if (delta >= 0 && spent >= budget) return false;

  if (next === 0) delete item.votes[playerId];
  else item.votes[playerId] = next;
  return true;
}

export const itemVoteTotal = (item) =>
  Object.values(item.votes).reduce((total, count) => total + count, 0);

/* ---------------------------------------------------------- Ceremonies -- */

export function setActivity(room, activity) {
  if (!ACTIVITY_IDS.includes(activity) || room.activity === activity) return false;
  room.activity = activity;
  return true;
}

export function setSprintGoal(room, goal) {
  room.sprintGoal = cleanText(goal, MAX_STORY);
}

export function startTimer(room, seconds, label) {
  const duration = Math.max(15, Math.min(3600, Math.round(Number(seconds) || 0)));
  room.timer = {
    label: cleanText(label, 60) || 'Timebox',
    duration,
    endsAt: Date.now() + duration * 1000,
  };
}

export function stopTimer(room) {
  room.timer = { label: '', endsAt: null, duration: 0 };
}

/** Point a poker round at a backlog item so the result can be written back. */
export function estimateBacklogItem(room, itemId) {
  const item = room.lists.backlog.find((entry) => entry.id === itemId);
  if (!item) return null;
  room.backlogRef = item.id;
  room.story = item.text.slice(0, MAX_STORY);
  room.activity = 'poker';
  resetRound(room);
  item.meta.status = 'estimating';
  return item;
}

/** Write the agreed card onto the backlog item and clear the link. */
export function recordEstimate(room, value) {
  if (!room.backlogRef) return null;
  const item = room.lists.backlog.find((entry) => entry.id === room.backlogRef);
  room.backlogRef = null;
  if (!item) return null;
  item.meta.estimate = value === null ? null : String(value).slice(0, 8);
  item.meta.status = value === null ? 'todo' : 'estimated';
  return item;
}

/* --- Retro --- */

export function setRetroTemplate(room, templateId) {
  const template = getRetroTemplate(templateId);
  if (template.id === room.retro.template) return false;
  room.retro.template = template.id;
  // Cards belong to columns that no longer exist; park them in the first one.
  const [first] = template.columns;
  for (const item of room.lists.retro) {
    if (!template.columns.some((column) => column.id === item.column)) {
      item.column = first.id;
    }
  }
  return true;
}

export function setRetroPhase(room, phase) {
  if (!RETRO_PHASES.includes(phase)) return false;
  room.retro.phase = phase;
  return true;
}

/* --- Standup --- */

export function startStandup(room, { shuffle = true } = {}) {
  const participants = [...room.players.values()].filter((p) => p.connected && !p.spectator);
  const order = participants.map((p) => p.id);
  if (shuffle) {
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
  }
  room.standup = {
    ...room.standup,
    order,
    index: 0,
    turnStartedAt: Date.now(),
    running: order.length > 0,
    finished: [],
  };
  return room.standup.running;
}

export function advanceStandup(room, step = 1) {
  const { standup } = room;
  if (!standup.running) return false;
  const current = standup.order[standup.index];
  if (step > 0 && current && !standup.finished.includes(current)) {
    standup.finished.push(current);
  }
  const next = standup.index + step;
  if (next >= standup.order.length) {
    standup.running = false;
    standup.turnStartedAt = null;
    standup.index = Math.max(0, standup.order.length - 1);
    return true;
  }
  standup.index = Math.max(0, next);
  standup.turnStartedAt = Date.now();
  return true;
}

export function stopStandup(room) {
  room.standup.running = false;
  room.standup.turnStartedAt = null;
}

/* --- Health check --- */

export function castHealthVote(room, playerId, dimension, level) {
  if (!HEALTH_DIMENSIONS.some((entry) => entry.id === dimension)) return false;
  if (level !== null && !HEALTH_LEVELS.some((entry) => entry.id === level)) return false;
  const votes = room.health.votes[playerId] ?? (room.health.votes[playerId] = {});
  if (level === null) delete votes[dimension];
  else votes[dimension] = level;
  return true;
}

export function healthSummary(room) {
  const voters = Object.keys(room.health.votes).filter(
    (id) => Object.keys(room.health.votes[id]).length > 0,
  );

  return HEALTH_DIMENSIONS.map((dimension) => {
    const counts = { green: 0, amber: 0, red: 0 };
    let score = 0;
    let responses = 0;

    for (const playerId of voters) {
      const level = room.health.votes[playerId][dimension.id];
      if (!level) continue;
      counts[level] += 1;
      responses += 1;
      score += HEALTH_LEVELS.find((entry) => entry.id === level).score;
    }

    return {
      id: dimension.id,
      counts,
      responses,
      average: responses ? Math.round((score / responses) * 50) : null,
    };
  });
}

export function resetHealth(room) {
  room.health = { revealed: false, votes: {} };
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
 * Serialize for a specific viewer.
 *
 * Two things are deliberately withheld: other people's poker votes before the
 * reveal, and other people's retro cards while the board is still in its
 * collect phase. Neither ever reaches another browser, so there is nothing to
 * peek at in devtools.
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
      healthDone: Object.keys(room.health.votes[p.id] ?? {}).length,
    }));

  const retroHidden = room.retro.phase === 'collect';

  const serializeItem = (item, { hidden = false } = {}) => {
    const mine = item.authorId === viewerId;
    const redact = hidden && !mine;
    return {
      id: item.id,
      text: redact ? '' : item.text,
      hidden: redact,
      mine,
      authorId: room.retro.anonymous && !mine ? null : item.authorId,
      authorName: room.retro.anonymous && !mine ? '' : item.authorName,
      column: item.column,
      done: item.done,
      meta: item.meta,
      votes: itemVoteTotal(item),
      myVotes: item.votes[viewerId] ?? 0,
      createdAt: item.createdAt,
    };
  };

  const lists = {};
  for (const name of LIST_NAMES) {
    lists[name] = room.lists[name].map((item) =>
      serializeItem(item, { hidden: name === 'retro' && retroHidden }),
    );
  }

  const retroSpent = room.lists.retro.reduce(
    (total, item) => total + (item.votes[viewerId] ?? 0),
    0,
  );

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

    activity: room.activity,
    sprintGoal: room.sprintGoal,
    timer: room.timer,
    lists,
    backlogRef: room.backlogRef,
    retro: {
      ...room.retro,
      votesSpent: retroSpent,
      cardCount: room.lists.retro.length,
    },
    standup: {
      ...room.standup,
      prompts: STANDUP_PROMPTS.map((prompt) => prompt.id),
    },
    health: {
      revealed: room.health.revealed,
      summary: room.health.revealed ? healthSummary(room) : null,
      mine: room.health.votes[viewerId] ?? {},
      responded: Object.keys(room.health.votes).filter(
        (id) => Object.keys(room.health.votes[id]).length > 0,
      ).length,
    },
  };
}

/** Periodic sweep — the only thing standing between us and a memory leak. */
export function sweep(now = Date.now()) {
  const removed = { players: [], rooms: [] };

  for (const room of rooms.values()) {
    for (const player of [...room.players.values()]) {
      if (!player.connected && player.disconnectedAt && now - player.disconnectedAt > RECONNECT_GRACE_MS) {
        room.players.delete(player.id);
        pruneStandup(room, player.id);
        delete room.health.votes[player.id];
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
