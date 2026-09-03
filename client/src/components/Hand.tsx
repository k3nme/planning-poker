import { useEffect } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { Deck } from '../types';
import { PlayingCard } from './PlayingCard';

type Props = {
  deck: Deck;
  selected: string | null;
  disabled: boolean;
  onSelect: (value: string | null) => void;
};

/**
 * The player's own hand: a shallow arc of cards that lifts on hover and pops
 * the chosen card out of the fan. Keys 1-9 and 0 select by position.
 */
export function Hand({ deck, selected, disabled, onSelect }: Props) {
  const reduced = useReducedMotion();
  const count = deck.cards.length;
  const spread = Math.min(3.6, 40 / count);
  // A shallow arch: the middle of the fan rides highest and nothing dips
  // below the baseline, so the hand never spills off the bottom of the screen.
  const arch = (offset: number) => Math.abs(offset) ** 2 * 0.95;
  const peak = arch((count - 1) / 2);

  useEffect(() => {
    if (disabled) return undefined;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === 'Escape') {
        onSelect(null);
        return;
      }
      if (!/^[0-9]$/.test(event.key)) return;
      const index = event.key === '0' ? 9 : Number(event.key) - 1;
      const card = deck.cards[index];
      if (card) {
        event.preventDefault();
        onSelect(card.value === selected ? null : card.value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deck, disabled, onSelect, selected]);

  return (
    <div className="hand">
      <div className="hand__inner">
        {deck.cards.map((card, index) => {
          const offset = index - (count - 1) / 2;
          const rotate = reduced ? 0 : offset * spread;
          const lift = reduced ? 0 : arch(offset) - peak;
          const isSelected = selected === card.value;

          return (
            <motion.button
              key={card.value}
              type="button"
              className="hand__slot"
              data-selected={isSelected}
              data-disabled={disabled}
              disabled={disabled}
              aria-pressed={isSelected}
              aria-label={`Vote ${card.label}`}
              style={{ zIndex: isSelected ? 20 : index }}
              initial={{ y: 120, opacity: 0, rotate }}
              animate={{
                y: isSelected ? lift - 26 : lift,
                rotate: isSelected ? 0 : rotate,
                opacity: 1,
                scale: isSelected ? 1.1 : 1,
              }}
              whileHover={
                disabled ? undefined : { y: lift - (isSelected ? 34 : 20), scale: 1.06, zIndex: 25 }
              }
              whileTap={disabled ? undefined : { scale: 0.97 }}
              transition={{
                type: 'spring',
                stiffness: 320,
                damping: 26,
                delay: reduced ? 0 : Math.min(index * 0.03, 0.3),
              }}
              onClick={() => onSelect(isSelected ? null : card.value)}
            >
              <PlayingCard deckId={deck.id} value={card.value} />
            </motion.button>
          );
        })}
      </div>

      <span className="hand__hint">
        {disabled ? (
          'Cards are on the table'
        ) : (
          <>
            Press <span className="kbd">1</span>–<span className="kbd">9</span> to vote,
            <span className="kbd">esc</span> to clear
          </>
        )}
      </span>
    </div>
  );
}
