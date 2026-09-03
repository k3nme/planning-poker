import { motion, type MotionProps } from 'motion/react';
import { cardLabel } from '../lib/decks';
import { clsx } from '../lib/format';

type Props = {
  deckId: string;
  value: string | null;
  /** When true the card shows its patterned back and flips on change. */
  faceDown?: boolean;
  corners?: boolean;
  className?: string;
  flipDelay?: number;
} & MotionProps;

const isEmoji = (label: string) => /\p{Extended_Pictographic}/u.test(label);

/**
 * A single card.
 *
 * Two nested elements on purpose: the outer one is free for enter/exit
 * animation passed in by the caller, while the inner one owns the 3D flip.
 * Sharing one element would let a caller's `animate` clobber the rotation.
 */
export function PlayingCard({
  deckId,
  value,
  faceDown = false,
  corners = true,
  className,
  flipDelay = 0,
  ...motionProps
}: Props) {
  const label = cardLabel(deckId, value);
  const emoji = isEmoji(label);
  const long = label.length > 2 && !emoji;

  return (
    <motion.div className={clsx('card-shell', className)} {...motionProps}>
      <motion.div
        className="card"
        animate={{ rotateY: faceDown ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 190, damping: 21, delay: flipDelay }}
      >
        <div className="card__face">
          {corners && !emoji && label && (
            <span className="card__corner card__corner--tl">{label}</span>
          )}
          <span
            className={clsx(
              'card__value',
              long && 'card__value--text',
              emoji && 'card__value--emoji',
            )}
          >
            {label}
          </span>
          {corners && !emoji && label && (
            <span className="card__corner card__corner--br">{label}</span>
          )}
          <span className="card__shine" />
        </div>
        <div className="card__back" />
      </motion.div>
    </motion.div>
  );
}
