import { AnimatePresence, motion } from 'motion/react';
import type { FlyingEmote, Toast } from '../types';
import { clsx } from '../lib/format';

export function Toasts({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.button
            key={toast.id}
            type="button"
            className={clsx('toast', `toast--${toast.tone}`)}
            onClick={() => onDismiss(toast.id)}
            layout
            initial={{ opacity: 0, x: 40, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.9, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          >
            {toast.icon && <span className="toast__icon">{toast.icon}</span>}
            <span>{toast.text}</span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Reactions drift up from the bottom of the screen and fade out. */
export function EmoteLayer({ emotes }: { emotes: FlyingEmote[] }) {
  return (
    <div className="emote-layer" aria-hidden="true">
      <AnimatePresence>
        {emotes.map((emote) => (
          <motion.span
            key={emote.id}
            className="emote"
            style={{ left: `${emote.x}%` }}
            initial={{ opacity: 0, y: 0, scale: 0.4 }}
            animate={{
              opacity: [0, 1, 1, 0],
              y: -280,
              scale: [0.4, 1.15, 1, 0.9],
              x: [0, 14, -10, 6],
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.4, ease: 'easeOut' }}
          >
            {emote.emoji}
            <span className="emote__name">{emote.name}</span>
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}
