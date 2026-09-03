import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ActivityId,
  ConnectionStatus,
  FlyingEmote,
  Item,
  ListName,
  RetroPhase,
  RoomEvent,
  RoomState,
  ServerMessage,
  Toast,
} from '../types';
import { getSessionId } from './session';

const socketUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
};

const RECONNECT_STEPS = [400, 900, 1800, 3200, 5000, 8000];

type Options = {
  roomId: string;
  name: string;
  spectator?: boolean;
  onFatal?: (message: string) => void;
};

let toastSeq = 0;

export function useRoom({ roomId, name, spectator = false, onFatal }: Options) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [youId, setYouId] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [emotes, setEmotes] = useState<FlyingEmote[]>([]);
  const [lastEvent, setLastEvent] = useState<{ event: RoomEvent; at: number } | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const closedByUs = useRef(false);
  const identity = useRef({ name, spectator });
  identity.current = { name, spectator };

  const pushToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = (toastSeq += 1);
    setToasts((current) => [...current.slice(-3), { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const send = useCallback((message: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }, []);

  useEffect(() => {
    if (!roomId) return undefined;
    closedByUs.current = false;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      setStatus((prev) => (prev === 'idle' ? 'connecting' : prev === 'live' ? 'reconnecting' : prev));

      const socket = new WebSocket(socketUrl());
      socketRef.current = socket;

      socket.onopen = () => {
        attemptRef.current = 0;
        setStatus('live');
        socket.send(
          JSON.stringify({
            t: 'join',
            roomId,
            sessionId: getSessionId(),
            name: identity.current.name,
            spectator: identity.current.spectator,
          }),
        );
      };

      socket.onmessage = (raw) => {
        let message: ServerMessage;
        try {
          message = JSON.parse(raw.data as string);
        } catch {
          return;
        }

        switch (message.t) {
          case 'welcome':
            setYouId(message.youId);
            setRoom(message.room);
            break;
          case 'state':
            setRoom(message.room);
            if (message.event) setLastEvent({ event: message.event, at: Date.now() });
            break;
          case 'emote': {
            const id = (toastSeq += 1);
            setEmotes((current) => [
              ...current.slice(-14),
              { id, emoji: message.emoji, name: message.name, x: 8 + Math.random() * 84 },
            ]);
            window.setTimeout(() => {
              setEmotes((current) => current.filter((e) => e.id !== id));
            }, 2600);
            break;
          }
          case 'error':
            if (message.code === 'no-room' || message.code === 'kicked' || message.code === 'full') {
              closedByUs.current = true;
              onFatal?.(message.message);
            } else {
              pushToast({ text: message.message, tone: 'bad' });
            }
            break;
          default:
            break;
        }
      };

      socket.onclose = () => {
        socketRef.current = null;
        if (disposed || closedByUs.current) {
          setStatus('closed');
          return;
        }
        setStatus('reconnecting');
        const delay = RECONNECT_STEPS[Math.min(attemptRef.current, RECONNECT_STEPS.length - 1)];
        attemptRef.current += 1;
        timerRef.current = window.setTimeout(connect, delay);
      };

      socket.onerror = () => socket.close();
    };

    connect();

    return () => {
      disposed = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      const socket = socketRef.current;
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ t: 'leave' }));
      socket?.close();
      socketRef.current = null;
    };
  }, [roomId, onFatal, pushToast]);

  /* Toasts for the human-interesting bits of every state push. */
  useEffect(() => {
    if (!lastEvent) return;
    const { event } = lastEvent;
    switch (event.kind) {
      case 'joined':
        pushToast({ text: `${event.name} joined`, tone: 'good', icon: '👋' });
        break;
      case 'left':
        pushToast({
          text: event.kicked ? `${event.name} was removed` : `${event.name} left`,
          tone: 'neutral',
          icon: event.kicked ? '🚪' : '👋',
        });
        break;
      case 'deck':
        pushToast({ text: `Deck switched to ${event.name}`, tone: 'neutral', icon: '🂠' });
        break;
      case 'host':
        pushToast({ text: `${event.name} is now the host`, tone: 'neutral', icon: '👑' });
        break;
      case 'activity':
        if (event.name) pushToast({ text: `Now running: ${event.name}`, tone: 'neutral', icon: '🎛' });
        break;
      case 'timer':
        pushToast({ text: `${event.label} started`, tone: 'neutral', icon: '⏱' });
        break;
      case 'estimating':
        pushToast({ text: `Estimating "${event.name}"`, tone: 'neutral', icon: '🃏' });
        break;
      case 'estimated':
        pushToast({ text: `Estimate saved to the backlog`, tone: 'good', icon: '✅' });
        break;
      default:
        break;
    }
  }, [lastEvent, pushToast]);

  const you = useMemo(
    () => room?.players.find((player) => player.id === youId) ?? null,
    [room, youId],
  );
  const isHost = Boolean(you?.isHost);

  const actions = useMemo(
    () => ({
      vote: (value: string | null) => send({ t: 'vote', value }),
      reveal: () => send({ t: 'reveal' }),
      reset: () => send({ t: 'reset' }),
      setStory: (title: string) => send({ t: 'story', title }),
      setDeck: (deckId: string) => send({ t: 'deck', deckId }),
      setAutoReveal: (value: boolean) => send({ t: 'autoReveal', value }),
      setSpectator: (value: boolean) => send({ t: 'spectator', value }),
      rename: (next: string) => send({ t: 'rename', name: next }),
      transferHost: (playerId: string) => send({ t: 'transferHost', playerId }),
      kick: (playerId: string) => send({ t: 'kick', playerId }),
      emote: (emoji: string) => send({ t: 'emote', emoji }),

      /* --- ceremonies --- */
      setActivity: (activity: ActivityId) => send({ t: 'activity', activity }),
      setSprintGoal: (goal: string) => send({ t: 'sprintGoal', goal }),
      startTimer: (seconds: number, label: string) => send({ t: 'timerStart', seconds, label }),
      stopTimer: () => send({ t: 'timerStop' }),

      /* --- list items, shared by every board in the room --- */
      addItem: (list: ListName, text: string, extra: Partial<Pick<Item, 'column' | 'meta'>> = {}) =>
        send({ t: 'itemAdd', list, text, column: extra.column, meta: extra.meta }),
      updateItem: (list: ListName, itemId: string, patch: Record<string, unknown>) =>
        send({ t: 'itemUpdate', list, itemId, patch }),
      removeItem: (list: ListName, itemId: string) => send({ t: 'itemRemove', list, itemId }),
      reorderItem: (list: ListName, itemId: string, toIndex: number) =>
        send({ t: 'itemReorder', list, itemId, toIndex }),
      voteItem: (list: ListName, itemId: string, delta: number) =>
        send({ t: 'itemVote', list, itemId, delta }),

      /* --- retro --- */
      setRetroTemplate: (templateId: string) => send({ t: 'retroTemplate', templateId }),
      setRetroPhase: (phase: RetroPhase) => send({ t: 'retroPhase', phase }),
      setRetroSettings: (settings: { anonymous?: boolean; votesPerPerson?: number }) =>
        send({ t: 'retroSettings', ...settings }),

      /* --- standup --- */
      startStandup: (perPerson: number, shuffle: boolean) =>
        send({ t: 'standupStart', perPerson, shuffle }),
      nextSpeaker: (step: 1 | -1 = 1) => send({ t: 'standupNext', step }),
      stopStandup: () => send({ t: 'standupStop' }),

      /* --- health check --- */
      healthVote: (dimension: string, level: string | null) =>
        send({ t: 'healthVote', dimension, level }),
      revealHealth: () => send({ t: 'healthReveal' }),
      resetHealth: () => send({ t: 'healthReset' }),

      /* --- backlog <-> poker --- */
      estimateItem: (itemId: string) => send({ t: 'estimateItem', itemId }),
      recordEstimate: (value: string | null) => send({ t: 'recordEstimate', value }),
    }),
    [send],
  );

  return { room, you, youId, isHost, status, toasts, emotes, lastEvent, actions, pushToast, dismissToast };
}

/** The action surface every ceremony stage is handed. */
export type RoomActions = ReturnType<typeof useRoom>['actions'];
