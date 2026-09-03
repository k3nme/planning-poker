import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Player } from '../types';
import { Avatar } from './Avatar';
import { PlayingCard } from './PlayingCard';

type Size = { width: number; height: number };

type SeatPosition = { left: string; top: string; x: number; y: number };

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentRect;
      setSize({ width: box.width, height: box.height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, size] as const;
}

function Seat({
  player,
  deckId,
  revealed,
  isYou,
  index,
  position,
}: {
  player: Player;
  deckId: string;
  revealed: boolean;
  isYou: boolean;
  index: number;
  /** Absolute placement on the ellipse, or null in the compact grid layout. */
  position: SeatPosition | null;
}) {
  const [pulse, setPulse] = useState(0);
  const previouslyVoted = useRef(player.hasVoted);

  useEffect(() => {
    if (player.hasVoted && !previouslyVoted.current) setPulse((n) => n + 1);
    previouslyVoted.current = player.hasVoted;
  }, [player.hasVoted]);

  const showCard = player.hasVoted && !player.spectator;

  return (
    <motion.div
      className="seat"
      data-you={isYou}
      data-off={!player.connected}
      style={position ? { left: position.left, top: position.top } : undefined}
      layout
      initial={{ opacity: 0, scale: 0.7 }}
      animate={
        position
          ? { opacity: 1, scale: 1, x: position.x, y: position.y }
          : { opacity: 1, scale: 1 }
      }
      exit={{ opacity: 0, scale: 0.7, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
    >
      <div className="seat__card">
        <AnimatePresence mode="popLayout" initial={false}>
          {player.spectator ? (
            <motion.div
              key="spectator"
              className="seat__empty"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              title="Observing"
            >
              👁
            </motion.div>
          ) : showCard ? (
            <PlayingCard
              key="card"
              deckId={deckId}
              value={player.vote}
              faceDown={!revealed || player.vote === null}
              corners={false}
              flipDelay={revealed ? 0.06 * index : 0}
              initial={{ opacity: 0, y: 18, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.85 }}
            />
          ) : (
            <motion.div
              key="empty"
              className="seat__empty"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
            >
              <motion.span
                animate={{ opacity: [0.35, 0.8, 0.35] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              >
                ·
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {pulse > 0 && (
            <motion.span
              key={pulse}
              className="seat__ping"
              initial={{ opacity: 0.9, scale: 0.9 }}
              animate={{ opacity: 0, scale: 1.35 }}
              transition={{ duration: 0.65, ease: 'easeOut' }}
              onAnimationComplete={() => setPulse(0)}
            />
          )}
        </AnimatePresence>
      </div>

      <Avatar name={player.name} hue={player.hue} size="sm" host={player.isHost} offline={!player.connected} />

      <span className="seat__label">
        <span className="seat__name">{isYou ? `${player.name} (you)` : player.name}</span>
        {player.spectator && <span className="seat__badge" title="Observer">👁</span>}
      </span>
    </motion.div>
  );
}

/**
 * Seats are laid out around an ellipse when there is room for it, and reflow
 * into a centred grid on small screens or with a big crowd. Because each seat
 * animates its `x`/`y`, people glide to their new spot as the table fills.
 */
export function Table({
  players,
  deckId,
  revealed,
  youId,
  children,
}: {
  players: Player[];
  deckId: string;
  revealed: boolean;
  youId: string | null;
  children?: React.ReactNode;
}) {
  const [ref, size] = useSize<HTMLDivElement>();
  const ellipse = size.width >= 660 && size.height >= 320 && players.length <= 12;

  const positions: (SeatPosition | null)[] = players.map((_, index) => {
    if (!ellipse) return null;
    const rx = size.width / 2 - 58;
    const ry = size.height / 2 - 66;
    // Start at the bottom of the table so the first seat faces the viewer.
    const angle = Math.PI / 2 + (index * 2 * Math.PI) / players.length;
    return {
      left: '50%',
      top: '50%',
      x: Math.cos(angle) * rx,
      y: Math.sin(angle) * ry,
    };
  });

  return (
    <div className="table-wrap">
      <div className="table" data-mode={ellipse ? 'ellipse' : 'grid'} ref={ref}>
        <div className="table__felt" />
        <div className="table__rim" aria-hidden="true" />

        {ellipse ? (
          <AnimatePresence initial={false}>
            {players.map((player, index) => (
              <Seat
                key={player.id}
                player={player}
                deckId={deckId}
                revealed={revealed}
                isYou={player.id === youId}
                index={index}
                position={positions[index]}
              />
            ))}
          </AnimatePresence>
        ) : (
          <div className="seats-grid">
            <AnimatePresence initial={false}>
              {players.map((player, index) => (
                <Seat
                  key={player.id}
                  player={player}
                  deckId={deckId}
                  revealed={revealed}
                  isYou={player.id === youId}
                  index={index}
                  position={null}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
