import { motion } from 'motion/react';

const EMOJIS = ['👍', '🎉', '🤔', '😂', '🔥', '☕'];

/** Reactions anyone can fire, in any ceremony. */
export function EmoteBar({ onEmote }: { onEmote: (emoji: string) => void }) {
  return (
    <div className="emote-bar">
      {EMOJIS.map((emoji) => (
        <motion.button
          key={emoji}
          type="button"
          className="emote-bar__btn"
          onClick={() => onEmote(emoji)}
          whileHover={{ scale: 1.25, y: -3 }}
          whileTap={{ scale: 0.85 }}
          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
          aria-label={`React with ${emoji}`}
        >
          {emoji}
        </motion.button>
      ))}
    </div>
  );
}
