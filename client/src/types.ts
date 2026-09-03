export type CardDef = {
  value: string;
  numeric: number | null;
  label: string;
};

export type Deck = {
  id: string;
  name: string;
  hint: string;
  cards: CardDef[];
};

export type Player = {
  id: string;
  name: string;
  hue: number;
  spectator: boolean;
  connected: boolean;
  isHost: boolean;
  hasVoted: boolean;
  /** Only populated for yourself, or for everyone once the round is revealed. */
  vote: string | null;
};

export type Stats = {
  average: number | null;
  median: number | null;
  consensus: boolean;
  spread: { min: number; max: number } | null;
  suggestion: string | null;
  voterCount: number;
  distribution: { value: string; count: number }[];
};

export type HistoryEntry = {
  round: number;
  story: string;
  endedAt: number;
  average: number | null;
  consensus: boolean;
  votes: { value: string; count: number }[];
};

export type RoomState = {
  id: string;
  name: string;
  deckId: string;
  story: string;
  revealed: boolean;
  autoReveal: boolean;
  round: number;
  roundStartedAt: number;
  revealedAt: number | null;
  hostId: string | null;
  players: Player[];
  stats: Stats | null;
  history: HistoryEntry[];
};

export type RoomEvent =
  | { kind: 'joined'; name: string; hue: number }
  | { kind: 'left'; name: string; kicked?: boolean }
  | { kind: 'revealed'; by?: string; auto?: boolean }
  | { kind: 'reset'; by: string }
  | { kind: 'deck'; name?: string }
  | { kind: 'host'; name: string };

export type ServerMessage =
  | { t: 'welcome'; youId: string; room: RoomState }
  | { t: 'state'; room: RoomState; event: RoomEvent | null }
  | { t: 'emote'; emoji: string; from: string; name: string }
  | { t: 'error'; code: string; message: string }
  | { t: 'pong'; now: number };

export type ConnectionStatus = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'closed';

export type Toast = {
  id: number;
  text: string;
  tone: 'neutral' | 'good' | 'bad';
  icon?: string;
};

export type FlyingEmote = {
  id: number;
  emoji: string;
  name: string;
  x: number;
};
