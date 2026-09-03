import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { ConnectionStatus, RoomState, Player } from '../types';
import { DECK_LIST, getDeck } from '../lib/decks';
import { celebrate } from '../lib/confetti';
import { copyText, formatDuration, roomUrl } from '../lib/format';
import { storeName } from '../lib/session';
import { Avatar } from './Avatar';
import { Console } from './Console';
import { Hand } from './Hand';
import { Rail } from './Rail';
import { Table } from './Table';

const EMOJIS = ['👍', '🎉', '🤔', '😂', '🔥', '☕'];

type Actions = {
  vote: (value: string | null) => void;
  reveal: () => void;
  reset: () => void;
  setStory: (title: string) => void;
  setDeck: (deckId: string) => void;
  setAutoReveal: (value: boolean) => void;
  setSpectator: (value: boolean) => void;
  rename: (name: string) => void;
  transferHost: (playerId: string) => void;
  kick: (playerId: string) => void;
  emote: (emoji: string) => void;
};

type Props = {
  room: RoomState;
  you: Player | null;
  youId: string | null;
  isHost: boolean;
  status: ConnectionStatus;
  actions: Actions;
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
  onLeave: () => void;
  onCopied: () => void;
};

const STATUS_TEXT: Record<ConnectionStatus, string> = {
  idle: 'Connecting',
  connecting: 'Connecting',
  live: 'Live',
  reconnecting: 'Reconnecting',
  closed: 'Offline',
};

function Switch({ on, onToggle, label, hint }: { on: boolean; onToggle: () => void; label: string; hint: string }) {
  return (
    <button type="button" className="switch-row" onClick={onToggle} style={{ width: '100%', textAlign: 'left' }}>
      <span>
        <span className="switch-row__text">{label}</span>
        <span className="switch-row__hint">{hint}</span>
      </span>
      <span className="switch" data-on={on} role="switch" aria-checked={on}>
        <motion.span
          className="switch__knob"
          layout
          transition={{ type: 'spring', stiffness: 620, damping: 36 }}
        />
      </span>
    </button>
  );
}

function Timer({ from, frozenAt }: { from: number; frozenAt: number | null }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (frozenAt) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [frozenAt]);

  return <span className="timer">{formatDuration((frozenAt ?? now) - from)}</span>;
}

export function Room({
  room,
  you,
  youId,
  isHost,
  status,
  actions,
  theme,
  onThemeToggle,
  onLeave,
  onCopied,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [storyDraft, setStoryDraft] = useState(room.story);
  const [nameDraft, setNameDraft] = useState(you?.name ?? '');
  const celebratedRound = useRef(-1);
  const deck = getDeck(room.deckId);

  useEffect(() => {
    setStoryDraft(room.story);
  }, [room.story, room.round]);

  useEffect(() => {
    if (you?.name) setNameDraft(you.name);
  }, [you?.name]);

  /* One burst per unanimous round, never twice. */
  useEffect(() => {
    if (!room.revealed || !room.stats?.consensus) return;
    if (celebratedRound.current === room.round) return;
    celebratedRound.current = room.round;
    window.setTimeout(() => celebrate(undefined, 130), 480);
  }, [room.revealed, room.stats?.consensus, room.round]);

  /* Escape closes the settings sheet. */
  useEffect(() => {
    if (!settingsOpen) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSettingsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [settingsOpen]);

  const handleCopy = useCallback(async () => {
    const ok = await copyText(roomUrl(room.id));
    if (!ok) return;
    setCopied(true);
    onCopied();
    window.setTimeout(() => setCopied(false), 1800);
  }, [room.id, onCopied]);

  /* Host shortcuts: space reveals, N starts the next round. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
      if (!isHost) return;
      if (event.code === 'Space' && !room.revealed) {
        event.preventDefault();
        actions.reveal();
      }
      if (event.key.toLowerCase() === 'n' && room.revealed) {
        event.preventDefault();
        actions.reset();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actions, isHost, room.revealed]);

  const voters = room.players.filter((player) => !player.spectator && player.connected);
  const canReveal = voters.length > 0 && voters.every((player) => player.hasVoted);
  const connected = room.players.filter((player) => player.connected);

  return (
    <div className="room">
      <header className="room__header">
        <button type="button" className="brand" onClick={onLeave} title="Leave room">
          <span className="brand__mark">♠</span>
        </button>

        <div className="room__id">
          <span className="room__name">{room.name}</span>
          <span className="room__meta">
            <span className={`dot ${status === 'live' ? 'dot--live' : status === 'closed' ? 'dot--bad' : 'dot--warn'}`} />
            {STATUS_TEXT[status]} · {deck.name}
          </span>
        </div>

        <div className="room__spacer" />

        <div className="stack">
          {connected.slice(0, 5).map((player) => (
            <Avatar
              key={player.id}
              name={player.name}
              hue={player.hue}
              size="sm"
              host={player.isHost}
            />
          ))}
          {connected.length > 5 && <span className="pill">+{connected.length - 5}</span>}
        </div>

        <motion.button
          type="button"
          className="copy-btn"
          onClick={handleCopy}
          whileTap={{ scale: 0.96 }}
          title="Copy the invite link"
        >
          {room.id}
          <span className="copy-btn__icon">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={copied ? 'done' : 'copy'}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.4, opacity: 0 }}
                transition={{ duration: 0.16 }}
              >
                {copied ? '✓' : '⧉'}
              </motion.span>
            </AnimatePresence>
          </span>
        </motion.button>

        <button
          type="button"
          className="btn btn--icon btn--ghost tip"
          data-tip="Settings"
          onClick={() => setSettingsOpen(true)}
          aria-label="Room settings"
        >
          ⚙
        </button>
        <button
          type="button"
          className="btn btn--icon btn--ghost tip"
          data-tip={theme === 'dark' ? 'Light' : 'Dark'}
          onClick={onThemeToggle}
          aria-label="Toggle colour theme"
        >
          {theme === 'dark' ? '☾' : '☀'}
        </button>
      </header>

      <div className="room__body">
        <main className="stage">
          <div className="story">
            <span className="story__round">Round {room.round}</span>
            <input
              className="story__input"
              value={storyDraft}
              disabled={!isHost}
              placeholder={isHost ? 'What are we estimating?' : 'No story set'}
              maxLength={140}
              onChange={(event) => setStoryDraft(event.target.value)}
              onBlur={() => actions.setStory(storyDraft)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
              }}
              aria-label="Story being estimated"
            />
            <Timer from={room.roundStartedAt} frozenAt={room.revealedAt} />
          </div>

          <Table
            players={room.players}
            deckId={room.deckId}
            revealed={room.revealed}
            youId={youId}
          >
            <Console
              room={room}
              isHost={isHost}
              canReveal={canReveal}
              onReveal={actions.reveal}
              onReset={actions.reset}
            />
          </Table>

          <div className="emote-bar">
            {EMOJIS.map((emoji) => (
              <motion.button
                key={emoji}
                type="button"
                className="emote-bar__btn"
                onClick={() => actions.emote(emoji)}
                whileHover={{ scale: 1.25, y: -3 }}
                whileTap={{ scale: 0.85 }}
                transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                aria-label={`React with ${emoji}`}
              >
                {emoji}
              </motion.button>
            ))}
          </div>

          <Hand
            deck={deck}
            selected={you?.vote ?? null}
            disabled={room.revealed || Boolean(you?.spectator)}
            onSelect={actions.vote}
          />
        </main>

        <Rail
          room={room}
          youId={youId}
          isHost={isHost}
          onKick={actions.kick}
          onPromote={actions.transferHost}
        />
      </div>

      <AnimatePresence>
        {settingsOpen && (
          <motion.div
            className="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSettingsOpen(false)}
          >
            <motion.div
              className="modal"
              initial={{ opacity: 0, y: 24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Room settings"
            >
              <h2 className="modal__title">Room settings</h2>
              <p className="modal__body">
                Nothing here is saved anywhere — this room only exists while somebody is in it.
              </p>

              <div className="modal__rows">
                <label className="field">
                  <span className="field__label">Your name</span>
                  <input
                    className="input"
                    value={nameDraft}
                    maxLength={24}
                    onChange={(event) => setNameDraft(event.target.value)}
                    onBlur={() => {
                      const next = nameDraft.trim();
                      if (next && next !== you?.name) {
                        actions.rename(next);
                        storeName(next);
                      }
                    }}
                  />
                </label>

                {isHost && (
                  <div className="field">
                    <span className="field__label">Deck</span>
                    <div className="decks">
                      {DECK_LIST.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          className="deck-chip"
                          data-active={room.deckId === option.id}
                          onClick={() => actions.setDeck(option.id)}
                        >
                          {room.deckId === option.id && (
                            <motion.span
                              layoutId="deck-glow-room"
                              className="deck-chip__glow"
                              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                            />
                          )}
                          <span style={{ position: 'relative' }}>{option.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <Switch
                  on={Boolean(you?.spectator)}
                  onToggle={() => actions.setSpectator(!you?.spectator)}
                  label="Observer mode"
                  hint="Watch the round without casting a vote."
                />

                {isHost && (
                  <Switch
                    on={room.autoReveal}
                    onToggle={() => actions.setAutoReveal(!room.autoReveal)}
                    label="Flip automatically"
                    hint="Turn all cards over the moment the last vote lands."
                  />
                )}
              </div>

              <div className="modal__actions">
                <button type="button" className="btn btn--danger" onClick={onLeave}>
                  Leave room
                </button>
                <button type="button" className="btn btn--primary" onClick={() => setSettingsOpen(false)}>
                  <span style={{ position: 'relative', zIndex: 1 }}>Done</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
