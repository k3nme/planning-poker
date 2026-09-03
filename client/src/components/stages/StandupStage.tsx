import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { StageProps } from './types';
import { STANDUP_PROMPTS } from '../../lib/templates';
import { formatDuration } from '../../lib/format';
import { Avatar } from '../Avatar';
import { ItemCard, ItemComposer } from '../ItemCard';
import { EmoteBar } from '../EmoteBar';

/**
 * The daily scrum as a round robin. One speaker at a time with a per-person
 * timebox, the rota visible to everyone, and a parking lot so tangents get
 * captured instead of eating the meeting.
 */
export function StandupStage({ room, youId, isHost, actions }: StageProps) {
  const [now, setNow] = useState(() => Date.now());
  const { standup } = room;

  useEffect(() => {
    if (!standup.running) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [standup.running]);

  const byId = (id: string) => room.players.find((player) => player.id === id) ?? null;
  const speakerId = standup.order[standup.index] ?? null;
  const speaker = speakerId ? byId(speakerId) : null;
  const elapsed = standup.turnStartedAt ? now - standup.turnStartedAt : 0;
  const budget = standup.perPerson * 1000;
  const over = elapsed > budget;
  const ratio = Math.max(0, Math.min(1, 1 - elapsed / budget));
  const yourTurn = speakerId === youId;

  const blockers = room.lists.parking.filter((item) => item.meta.kind === 'blocker');
  const parked = room.lists.parking.filter((item) => item.meta.kind !== 'blocker');

  return (
    <div className="board board--single standup">
      <header className="board__head">
        <h2 className="board__title">Daily scrum</h2>
        <span className="board__spacer" />
        {standup.running ? (
          <span className="pill">
            {standup.index + 1} of {standup.order.length}
          </span>
        ) : (
          <span className="pill">{standup.finished.length ? 'Finished' : 'Not started'}</span>
        )}
        {isHost && (
          <>
            <label className="mini-field">
              <span>Each</span>
              <select
                className="mini-select"
                value={standup.perPerson}
                onChange={(event) =>
                  actions.startStandup(Number(event.target.value), !standup.running)
                }
                aria-label="Seconds per person"
              >
                {[30, 60, 90, 120, 180].map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {seconds}s
                  </option>
                ))}
              </select>
            </label>
            {standup.running ? (
              <button type="button" className="btn btn--ghost btn--sm" onClick={actions.stopStandup}>
                End
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => actions.startStandup(standup.perPerson, true)}
              >
                <span style={{ position: 'relative', zIndex: 1 }}>Start round robin</span>
              </button>
            )}
          </>
        )}
      </header>

      <div className="standup__stage">
        <AnimatePresence mode="wait">
          {speaker && standup.running ? (
            <motion.div
              key={speaker.id}
              className="speaker"
              data-you={yourTurn}
              initial={{ opacity: 0, y: 24, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -24, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            >
              <div className="speaker__ring" data-over={over}>
                <svg viewBox="0 0 120 120" aria-hidden="true">
                  <circle cx="60" cy="60" r="54" fill="none" stroke="var(--surface-3)" strokeWidth="5" />
                  <motion.circle
                    cx="60"
                    cy="60"
                    r="54"
                    fill="none"
                    stroke={over ? '#f87171' : 'var(--violet)'}
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 54}
                    animate={{ strokeDashoffset: 2 * Math.PI * 54 * (1 - ratio) }}
                    transition={{ ease: 'linear', duration: 0.5 }}
                    transform="rotate(-90 60 60)"
                  />
                </svg>
                <Avatar name={speaker.name} hue={speaker.hue} size="lg" host={speaker.isHost} />
              </div>

              <h3 className="speaker__name">
                {yourTurn ? 'Your turn' : speaker.name}
              </h3>
              <span className="speaker__clock" data-over={over}>
                {over ? `+${formatDuration(elapsed - budget)} over` : formatDuration(budget - elapsed)}
              </span>

              <ul className="prompts">
                {STANDUP_PROMPTS.map((prompt, index) => (
                  <motion.li
                    key={prompt.id}
                    className="prompt"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.12 + index * 0.08 }}
                  >
                    <span className="prompt__icon">{prompt.icon}</span>
                    {prompt.label}
                  </motion.li>
                ))}
              </ul>

              {isHost && (
                <div className="speaker__controls">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => actions.nextSpeaker(-1)}
                    disabled={standup.index === 0}
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => actions.nextSpeaker(1)}
                  >
                    <span style={{ position: 'relative', zIndex: 1 }}>
                      {standup.index === standup.order.length - 1 ? 'Finish' : 'Next person →'}
                    </span>
                  </button>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              className="standup__idle"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.span
                className="standup__sun"
                animate={{ rotate: 360 }}
                transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
              >
                ☀
              </motion.span>
              <p>
                {standup.finished.length
                  ? `Standup done — ${standup.finished.length} people spoke.`
                  : isHost
                    ? 'Start the round robin when everyone has arrived.'
                    : 'Waiting for the host to start the standup.'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <ol className="rota">
          {standup.order.map((id, index) => {
            const player = byId(id);
            if (!player) return null;
            const done = standup.finished.includes(id);
            return (
              <motion.li
                key={id}
                className="rota__item"
                data-active={index === standup.index && standup.running}
                data-done={done}
                layout
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              >
                <Avatar name={player.name} hue={player.hue} size="sm" offline={!player.connected} />
                <span className="rota__name">{player.name}</span>
                {done && <span className="rota__tick">✓</span>}
              </motion.li>
            );
          })}
          {standup.order.length === 0 && <li className="column__empty">Nobody in the rota yet.</li>}
        </ol>
      </div>

      <section className="side-lists">
        <div className="side-lists__col">
          <h3 className="rail__title">🚧 Blockers</h3>
          <ItemComposer
            compact
            hue={0}
            placeholder="What is in someone's way?"
            onAdd={(text) => actions.addItem('parking', text, { meta: { kind: 'blocker' } })}
          />
          <div className="column__cards">
            <AnimatePresence initial={false}>
              {blockers.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  hue={0}
                  canEdit={item.mine || isHost}
                  onEdit={(text) => actions.updateItem('parking', item.id, { text })}
                  onRemove={() => actions.removeItem('parking', item.id)}
                  onToggleDone={() => actions.updateItem('parking', item.id, { done: !item.done })}
                />
              ))}
            </AnimatePresence>
            {blockers.length === 0 && <p className="column__empty">Nothing blocked. </p>}
          </div>
        </div>

        <div className="side-lists__col">
          <h3 className="rail__title">🅿 Parking lot</h3>
          <ItemComposer
            compact
            hue={45}
            placeholder="Take this offline…"
            onAdd={(text) => actions.addItem('parking', text)}
          />
          <div className="column__cards">
            <AnimatePresence initial={false}>
              {parked.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  hue={45}
                  canEdit={item.mine || isHost}
                  onEdit={(text) => actions.updateItem('parking', item.id, { text })}
                  onRemove={() => actions.removeItem('parking', item.id)}
                  onToggleDone={() => actions.updateItem('parking', item.id, { done: !item.done })}
                />
              ))}
            </AnimatePresence>
            {parked.length === 0 && <p className="column__empty">Nothing parked.</p>}
          </div>
        </div>
      </section>

      <EmoteBar onEmote={actions.emote} />
    </div>
  );
}
