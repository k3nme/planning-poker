import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { ActivityId, ConnectionStatus, RoomState, Player } from '../types';
import type { RoomActions } from '../lib/useRoom';
import { DECK_LIST } from '../lib/decks';
import { ACTIVITIES } from '../lib/templates';
import { copyText, roomUrl } from '../lib/format';
import { storeName } from '../lib/session';
import { ActivityBar } from './ActivityBar';
import { Avatar } from './Avatar';
import { Rail } from './Rail';
import { TimeboxBar } from './TimeboxBar';
import { BacklogStage } from './stages/BacklogStage';
import { HealthStage } from './stages/HealthStage';
import { PokerStage } from './stages/PokerStage';
import { RetroStage } from './stages/RetroStage';
import { ReviewStage } from './stages/ReviewStage';
import { StandupStage } from './stages/StandupStage';

type Props = {
  room: RoomState;
  you: Player | null;
  youId: string | null;
  isHost: boolean;
  status: ConnectionStatus;
  actions: RoomActions;
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
  const [nameDraft, setNameDraft] = useState(you?.name ?? '');
  const activity = ACTIVITIES.find((entry) => entry.id === room.activity) ?? ACTIVITIES[0];

  useEffect(() => {
    if (you?.name) setNameDraft(you.name);
  }, [you?.name]);

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

  const connected = room.players.filter((player) => player.connected);

  /* A count on each tab so people can see where the work is piling up. */
  const badges: Partial<Record<ActivityId, number>> = {
    backlog: room.lists.backlog.length,
    retro: room.retro.cardCount,
    review: room.lists.review.length,
    health: room.health.revealed ? room.health.responded : undefined,
  };

  const Stage = {
    poker: PokerStage,
    backlog: BacklogStage,
    standup: StandupStage,
    retro: RetroStage,
    review: ReviewStage,
    health: HealthStage,
  }[room.activity];

  return (
    <div className="room">
      <header className="room__header">
        <button type="button" className="brand" onClick={onLeave} title="Leave room">
          <span className="brand__mark">♠</span>
        </button>

        <div className="room__id">
          <span className="room__name">{room.name}</span>
          <span className="room__meta">
            <span
              className={`dot ${
                status === 'live' ? 'dot--live' : status === 'closed' ? 'dot--bad' : 'dot--warn'
              }`}
            />
            {STATUS_TEXT[status]} · {activity.name}
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

      <ActivityBar
        current={room.activity}
        isHost={isHost}
        onSelect={actions.setActivity}
        badges={badges}
      />

      <TimeboxBar
        timer={room.timer}
        sprintGoal={room.sprintGoal}
        isHost={isHost}
        onStart={actions.startTimer}
        onStop={actions.stopTimer}
        onGoal={actions.setSprintGoal}
        activityName={activity.name}
      />

      <div className="room__body">
        <main className="stage">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={room.activity}
              className="stage__inner"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            >
              <Stage room={room} you={you} youId={youId} isHost={isHost} actions={actions} />
            </motion.div>
          </AnimatePresence>
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
