import { AnimatePresence, motion } from 'motion/react';
import type { RoomState } from '../types';
import { cardLabel } from '../lib/decks';
import { formatNumber } from '../lib/format';
import { Avatar } from './Avatar';

type Props = {
  room: RoomState;
  youId: string | null;
  isHost: boolean;
  onKick: (playerId: string) => void;
  onPromote: (playerId: string) => void;
};

export function Rail({ room, youId, isHost, onKick, onPromote }: Props) {
  const stats = room.stats;
  const max = stats ? Math.max(...stats.distribution.map((entry) => entry.count), 1) : 1;

  return (
    <aside className="rail">
      <AnimatePresence initial={false}>
        {stats && (
          <motion.section
            key="stats"
            className="rail__section"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <h2 className="rail__title">This round</h2>

            <div className="stat-grid">
              <div className="stat">
                <div className="stat__label">Average</div>
                <div className="stat__value">
                  {stats.average === null ? '—' : formatNumber(stats.average)}
                </div>
              </div>
              <div className="stat">
                <div className="stat__label">Median</div>
                <div className="stat__value">
                  {stats.median === null ? '—' : formatNumber(stats.median)}
                </div>
              </div>
              <div className="stat">
                <div className="stat__label">Spread</div>
                <div className="stat__value">
                  {stats.spread ? `${formatNumber(stats.spread.min)}–${formatNumber(stats.spread.max)}` : '—'}
                </div>
              </div>
              <div className="stat">
                <div className="stat__label">Voted</div>
                <div className="stat__value">{stats.voterCount}</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 4 }}>
              {stats.distribution.map((entry, index) => (
                <div className="bar" key={entry.value}>
                  <span className="bar__key">{cardLabel(room.deckId, entry.value)}</span>
                  <span className="bar__track">
                    <motion.span
                      className="bar__fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${(entry.count / max) * 100}%` }}
                      transition={{
                        type: 'spring',
                        stiffness: 130,
                        damping: 20,
                        delay: 0.4 + index * 0.06,
                      }}
                    />
                  </span>
                  <span className="bar__count">{entry.count}</span>
                </div>
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <section className="rail__section">
        <h2 className="rail__title">
          At the table · {room.players.filter((player) => player.connected).length}
        </h2>
        <ul className="people">
          <AnimatePresence initial={false}>
            {room.players.map((player) => (
              <motion.li
                key={player.id}
                className="person"
                layout
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              >
                <Avatar
                  name={player.name}
                  hue={player.hue}
                  size="sm"
                  host={player.isHost}
                  offline={!player.connected}
                />
                <span className="person__name">
                  {player.name}
                  {player.id === youId && <span style={{ color: 'var(--ink-faint)' }}> · you</span>}
                </span>

                {player.spectator ? (
                  <span title="Observer" style={{ fontSize: 12 }}>👁</span>
                ) : (
                  <span
                    className="dot"
                    style={{
                      background: player.hasVoted ? 'var(--lime)' : 'var(--ink-faint)',
                    }}
                    title={player.hasVoted ? 'Voted' : 'Still thinking'}
                  />
                )}

                {isHost && player.id !== youId && (
                  <span className="person__tools">
                    {player.connected && !player.isHost && (
                      <button
                        type="button"
                        className="icon-btn"
                        title="Make host"
                        onClick={() => onPromote(player.id)}
                      >
                        👑
                      </button>
                    )}
                    <button
                      type="button"
                      className="icon-btn"
                      title="Remove from room"
                      onClick={() => onKick(player.id)}
                    >
                      ✕
                    </button>
                  </span>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </section>

      {room.history.length > 0 && (
        <section className="rail__section">
          <h2 className="rail__title">Earlier rounds</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <AnimatePresence initial={false}>
              {room.history.map((entry) => (
                <motion.div
                  key={`${entry.round}-${entry.endedAt}`}
                  className="history-item"
                  layout
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                >
                  <span className="history-item__round">#{entry.round}</span>
                  <span className="history-item__story">{entry.story || 'Untitled'}</span>
                  {entry.consensus && <span title="Unanimous">✦</span>}
                  <span className="history-item__avg">
                    {entry.average === null ? '—' : formatNumber(entry.average)}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}
    </aside>
  );
}
