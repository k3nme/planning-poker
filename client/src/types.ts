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

export type ActivityId = 'poker' | 'backlog' | 'standup' | 'retro' | 'review' | 'health';

export type Activity = {
  id: ActivityId;
  name: string;
  icon: string;
  hint: string;
};

export type RetroColumn = {
  id: string;
  label: string;
  icon: string;
  hue: number;
  hint?: string;
};

export type RetroTemplate = {
  id: string;
  name: string;
  columns: RetroColumn[];
};

export type RetroPhase = 'collect' | 'reveal' | 'vote' | 'act';

export type HealthDimension = { id: string; label: string; hint: string };

export type HealthLevel = {
  id: 'green' | 'amber' | 'red';
  label: string;
  icon: string;
  score: number;
  hue: number;
};

export type StandupPrompt = { id: string; label: string; icon: string };

export type ListName = 'backlog' | 'retro' | 'review' | 'actions' | 'parking' | 'dod';

/** One shape behind the backlog, retro board, review agenda, actions and DoD. */
export type Item = {
  id: string;
  text: string;
  /** True when someone else's retro card is still face down. */
  hidden: boolean;
  mine: boolean;
  authorId: string | null;
  authorName: string;
  column: string;
  done: boolean;
  meta: {
    estimate?: string | null;
    status?: 'todo' | 'estimating' | 'estimated';
    presenter?: string;
    owner?: string;
    [key: string]: unknown;
  };
  votes: number;
  myVotes: number;
  createdAt: number;
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
  /** How many health-check dimensions this person has answered. */
  healthDone: number;
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

  activity: ActivityId;
  sprintGoal: string;
  timer: { label: string; endsAt: number | null; duration: number };
  lists: Record<ListName, Item[]>;
  /** Set while a poker round is estimating a specific backlog item. */
  backlogRef: string | null;
  retro: {
    template: string;
    phase: RetroPhase;
    votesPerPerson: number;
    anonymous: boolean;
    votesSpent: number;
    cardCount: number;
  };
  standup: {
    order: string[];
    index: number;
    perPerson: number;
    turnStartedAt: number | null;
    running: boolean;
    finished: string[];
    prompts: string[];
  };
  health: {
    revealed: boolean;
    summary:
      | {
          id: string;
          counts: { green: number; amber: number; red: number };
          responses: number;
          average: number | null;
        }[]
      | null;
    mine: Record<string, 'green' | 'amber' | 'red'>;
    responded: number;
  };
};

export type RoomEvent =
  | { kind: 'joined'; name: string; hue: number }
  | { kind: 'left'; name: string; kicked?: boolean }
  | { kind: 'revealed'; by?: string; auto?: boolean }
  | { kind: 'reset'; by: string }
  | { kind: 'deck'; name?: string }
  | { kind: 'host'; name: string }
  | { kind: 'activity'; name?: string }
  | { kind: 'timer'; label: string }
  | { kind: 'retro'; phase: RetroPhase }
  | { kind: 'standup' }
  | { kind: 'health' }
  | { kind: 'estimating'; name: string }
  | { kind: 'estimated'; name: string };

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
