import { AnimatePresence, motion } from 'motion/react';
import type { StageProps } from './types';
import { HEALTH_DIMENSIONS, HEALTH_LEVELS } from '../../lib/templates';
import { EmoteBar } from '../EmoteBar';

/**
 * Squad health check. Everyone rates each dimension privately; the aggregate
 * only exists once the host reveals it, so nobody anchors on the first answer.
 */
export function HealthStage({ room, isHost, actions }: StageProps) {
  const { revealed, summary, mine, responded } = room.health;
  const answered = Object.keys(mine).length;
  const participants = room.players.filter((player) => player.connected && !player.spectator);

  return (
    <div className="board board--single">
      <header className="board__head">
        <h2 className="board__title">Team health check</h2>
        <span className="board__spacer" />
        <span className="pill">
          {revealed ? `${responded} responses` : `${answered}/${HEALTH_DIMENSIONS.length} answered`}
        </span>
        {!revealed && (
          <span className="pill">
            {responded}/{participants.length} people
          </span>
        )}
        {isHost &&
          (revealed ? (
            <button type="button" className="btn btn--ghost btn--sm" onClick={actions.resetHealth}>
              Start over
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={actions.revealHealth}
              disabled={responded === 0}
            >
              <span style={{ position: 'relative', zIndex: 1 }}>Reveal results</span>
            </button>
          ))}
      </header>

      <div className="health">
        {HEALTH_DIMENSIONS.map((dimension, index) => {
          const result = summary?.find((entry) => entry.id === dimension.id) ?? null;
          const chosen = mine[dimension.id];

          return (
            <motion.section
              className="health-row"
              key={dimension.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, type: 'spring', stiffness: 300, damping: 28 }}
            >
              <div className="health-row__label">
                <span className="health-row__name">{dimension.label}</span>
                <span className="health-row__hint">{dimension.hint}</span>
              </div>

              <AnimatePresence mode="wait" initial={false}>
                {revealed && result ? (
                  <motion.div
                    key="result"
                    className="health-row__result"
                    initial={{ opacity: 0, x: 14 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <span className="health-bar">
                      {HEALTH_LEVELS.map((level) => {
                        const count = result.counts[level.id];
                        if (!count) return null;
                        return (
                          <motion.span
                            key={level.id}
                            className="health-bar__seg"
                            style={{ '--hue': String(level.hue) } as React.CSSProperties}
                            initial={{ flexGrow: 0 }}
                            animate={{ flexGrow: count }}
                            transition={{
                              type: 'spring',
                              stiffness: 140,
                              damping: 22,
                              delay: 0.15 + index * 0.05,
                            }}
                            title={`${count} × ${level.label}`}
                          >
                            {count}
                          </motion.span>
                        );
                      })}
                    </span>
                    <span
                      className="health-row__score"
                      data-tone={
                        (result.average ?? 0) >= 70 ? 'good' : (result.average ?? 0) >= 40 ? 'mid' : 'bad'
                      }
                    >
                      {result.average === null ? '—' : `${result.average}%`}
                    </span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="vote"
                    className="health-row__choices"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {HEALTH_LEVELS.map((level) => (
                      <motion.button
                        key={level.id}
                        type="button"
                        className="health-choice"
                        data-active={chosen === level.id}
                        style={{ '--hue': String(level.hue) } as React.CSSProperties}
                        onClick={() =>
                          actions.healthVote(dimension.id, chosen === level.id ? null : level.id)
                        }
                        whileHover={{ scale: 1.12, y: -2 }}
                        whileTap={{ scale: 0.92 }}
                        transition={{ type: 'spring', stiffness: 460, damping: 22 }}
                        aria-label={`${dimension.label}: ${level.label}`}
                        aria-pressed={chosen === level.id}
                      >
                        {level.icon}
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.section>
          );
        })}
      </div>

      {!revealed && (
        <p className="board__note">
          Your answers stay on the server until the host reveals them — nobody sees what you picked.
        </p>
      )}

      <EmoteBar onEmote={actions.emote} />
    </div>
  );
}
