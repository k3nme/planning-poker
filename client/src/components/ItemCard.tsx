import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Item } from '../types';
import { clsx } from '../lib/format';

type CardProps = {
  item: Item;
  hue?: number;
  /** Dot voting, when the board is in a phase that allows it. */
  voting?: boolean;
  canEdit: boolean;
  /** Byline to print, or null for lists where authorship is noise. */
  authorLabel?: string | null;
  onVote?: (delta: number) => void;
  onEdit?: (text: string) => void;
  onRemove?: () => void;
  onToggleDone?: () => void;
  trailing?: React.ReactNode;
};

/**
 * The sticky note used across every board. A card whose author has not
 * revealed it yet arrives from the server with no text at all, so the
 * face-down state here is a genuine absence rather than a CSS trick.
 */
export function ItemCard({
  item,
  hue = 265,
  voting = false,
  canEdit,
  authorLabel = null,
  onVote,
  onEdit,
  onRemove,
  onToggleDone,
  trailing,
}: CardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(item.text);
  }, [item.text]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== item.text) onEdit?.(next);
    else setDraft(item.text);
  };

  if (item.hidden) {
    return (
      <motion.div
        className="sticky sticky--hidden"
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        style={{ '--hue': String(hue) } as React.CSSProperties}
        aria-label="A card someone is still writing"
      >
        <span className="sticky__shimmer" />
        <span className="sticky__lock">✎</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={clsx('sticky', item.done && 'sticky--done')}
      layout
      initial={{ opacity: 0, y: -8, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.16 } }}
      transition={{ type: 'spring', stiffness: 340, damping: 30 }}
      style={{ '--hue': String(hue) } as React.CSSProperties}
    >
      {editing ? (
        <textarea
          ref={inputRef}
          className="sticky__input"
          value={draft}
          rows={3}
          maxLength={280}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              commit();
            }
            if (event.key === 'Escape') {
              setDraft(item.text);
              setEditing(false);
            }
          }}
        />
      ) : (
        <p
          className="sticky__text"
          onDoubleClick={() => canEdit && setEditing(true)}
          title={canEdit ? 'Double-click to edit' : undefined}
        >
          {item.text}
        </p>
      )}

      <div className="sticky__foot">
        {authorLabel && <span className="sticky__author">{authorLabel}</span>}

        <span className="sticky__spacer" />
        {trailing}

        {onToggleDone && (
          <button
            type="button"
            className="icon-btn"
            onClick={onToggleDone}
            title={item.done ? 'Mark as not done' : 'Mark as done'}
            aria-pressed={item.done}
          >
            {item.done ? '☑' : '☐'}
          </button>
        )}

        {canEdit && onRemove && (
          <button type="button" className="icon-btn" onClick={onRemove} title="Delete">
            ✕
          </button>
        )}

        {voting && onVote && (
          <span className="dots">
            <button
              type="button"
              className="dots__btn"
              onClick={() => onVote(-1)}
              disabled={item.myVotes === 0}
              aria-label="Remove a vote"
            >
              −
            </button>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={item.votes}
                className="dots__count"
                initial={{ y: -8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 8, opacity: 0 }}
                transition={{ duration: 0.16 }}
              >
                {item.votes}
              </motion.span>
            </AnimatePresence>
            <button
              type="button"
              className="dots__btn dots__btn--add"
              onClick={() => onVote(1)}
              aria-label="Add a vote"
            >
              +
            </button>
          </span>
        )}

        {!voting && item.votes > 0 && <span className="sticky__votes">●{item.votes}</span>}
      </div>

      {item.myVotes > 0 && (
        <motion.span
          className="sticky__mine"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
        >
          {item.myVotes}
        </motion.span>
      )}
    </motion.div>
  );
}

/** Shared "add a card" box. Enter submits, Shift+Enter makes a new line. */
export function ItemComposer({
  placeholder,
  onAdd,
  hue = 265,
  compact = false,
}: {
  placeholder: string;
  onAdd: (text: string) => void;
  hue?: number;
  compact?: boolean;
}) {
  const [text, setText] = useState('');

  const submit = () => {
    const next = text.trim();
    if (!next) return;
    onAdd(next);
    setText('');
  };

  return (
    <form
      className={clsx('composer', compact && 'composer--compact')}
      style={{ '--hue': String(hue) } as React.CSSProperties}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <textarea
        className="composer__input"
        value={text}
        placeholder={placeholder}
        rows={compact ? 1 : 2}
        maxLength={280}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
      />
      <AnimatePresence>
        {text.trim() && (
          <motion.button
            type="submit"
            className="composer__add"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            whileTap={{ scale: 0.9 }}
            aria-label="Add"
          >
            ↵
          </motion.button>
        )}
      </AnimatePresence>
    </form>
  );
}
