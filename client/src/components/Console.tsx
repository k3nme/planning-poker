import { useEffect } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'motion/react';
import type { RoomState } from '../types';
import { cardLabel } from '../lib/decks';
import { formatNumber } from '../lib/format';

const RING = 46;
const CIRCUMFERENCE = 2 * Math.PI * RING;

function CountUp({ value }: { value: number }) {
  const motionValue = useMotionValue(0);
  const text = useTransform(motionValue, (current) => formatNumber(Math.round(current * 10) / 10));

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration: 1.05,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [motionValue, value]);

  return <motion.span>{text}</motion.span>;
}

function ProgressRing({ voted, total }: { voted: number; total: number }) {
  const ratio = total ? voted / total : 0;

  return (
    <div className="progress-ring">
      <svg width="112" height="112" viewBox="0 0 112 112" aria-hidden="true">
        <circle
          cx="56"
          cy="56"
          r={RING}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth="7"
        />
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <motion.circle
          cx="56"
          cy="56"
          r={RING}
          fill="none"
          stroke="url(#ring-grad)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          initial={{ strokeDashoffset: CIRCUMFERENCE }}
          animate={{ strokeDashoffset: CIRCUMFERENCE * (1 - ratio) }}
          transition={{ type: 'spring', stiffness: 90, damping: 20 }}
          transform="rotate(-90 56 56)"
        />
      </svg>
      <span className="progress-ring__count">
        {voted}
        <span style={{ color: 'var(--ink-faint)', fontSize: 14 }}>/{total}</span>
      </span>
    </div>
  );
}

type Props = {
  room: RoomState;
  isHost: boolean;
  canReveal: boolean;
  onReveal: () => void;
  onReset: () => void;
};

export function Console({ room, isHost, canReveal, onReveal, onReset }: Props) {
  const voters = room.players.filter((player) => !player.spectator && player.connected);
  const voted = voters.filter((player) => player.hasVoted).length;
  const stats = room.stats;

  return (
    <div className="console">
      <AnimatePresence mode="wait" initial={false}>
        {room.revealed && stats ? (
          <motion.div
            key="results"
            className="result"
            initial={{ opacity: 0, scale: 0.85, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 240, damping: 24, delay: 0.35 }}
          >
            <span className="result__value">
              {stats.average === null ? '—' : <CountUp value={stats.average} />}
            </span>
            <span className="result__label">Average</span>

            <div className="result__row">
              {stats.consensus ? (
                <motion.span
                  className="consensus-badge"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.6 }}
                >
                  ✦ Unanimous
                </motion.span>
              ) : (
                <>
                  {stats.median !== null && (
                    <span className="pill">Median {formatNumber(stats.median)}</span>
                  )}
                  {stats.suggestion && (
                    <span className="pill pill--accent">
                      Closest card {cardLabel(room.deckId, stats.suggestion)}
                    </span>
                  )}
                </>
              )}
            </div>

            {isHost && (
              <motion.button
                type="button"
                className="btn btn--primary"
                style={{ marginTop: 14 }}
                onClick={onReset}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
              >
                <span style={{ position: 'relative', zIndex: 1 }}>Next round →</span>
              </motion.button>
            )}
          </motion.div>
        ) : canReveal && isHost ? (
          <motion.div
            key="reveal"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          >
            <motion.button
              type="button"
              className="btn btn--primary btn--lg"
              onClick={onReveal}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.96 }}
              animate={{ boxShadow: ['0 0 0 0px var(--glow)', '0 0 0 16px transparent'] }}
              transition={{
                boxShadow: { duration: 1.8, repeat: Infinity, ease: 'easeOut' },
                default: { type: 'spring', stiffness: 400, damping: 22 },
              }}
            >
              <span style={{ position: 'relative', zIndex: 1 }}>Reveal cards</span>
            </motion.button>
            <span className="console__status">Everyone has voted</span>
          </motion.div>
        ) : (
          <motion.div
            key="progress"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          >
            <ProgressRing voted={voted} total={voters.length} />
            <span className="console__status">
              {voters.length === 0
                ? 'Waiting for players'
                : canReveal
                  ? 'Waiting for the host'
                  : voted === 0
                    ? 'Pick a card'
                    : `${voters.length - voted} still deciding`}
            </span>
            {isHost && voted > 0 && !canReveal && (
              <button type="button" className="btn btn--ghost" onClick={onReveal}>
                Reveal anyway
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
