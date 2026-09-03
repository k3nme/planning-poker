import { AnimatePresence, motion } from 'motion/react';
import type { StageProps } from './types';
import { ItemCard, ItemComposer } from '../ItemCard';
import { EmoteBar } from '../EmoteBar';

const STATUS_LABEL: Record<string, string> = {
  todo: 'Not estimated',
  estimating: 'On the table',
  estimated: 'Estimated',
};

/**
 * Backlog refinement. The list doubles as the queue for planning poker:
 * "Estimate" hands an item to the poker table, and the agreed card comes
 * straight back onto the row.
 */
export function BacklogStage({ room, isHost, actions }: StageProps) {
  const items = room.lists.backlog;
  const estimated = items.filter((item) => item.meta.status === 'estimated');
  const total = estimated.reduce((sum, item) => {
    const value = Number(item.meta.estimate);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);

  return (
    <div className="board board--single">
      <header className="board__head">
        <h2 className="board__title">Sprint backlog</h2>
        <span className="board__spacer" />
        <span className="pill">
          {estimated.length}/{items.length} estimated
        </span>
        {total > 0 && <span className="pill pill--accent">{total} points</span>}
      </header>

      <div className="board__body">
        <ItemComposer
          placeholder="Add a story, bug or spike…"
          onAdd={(text) => actions.addItem('backlog', text, { meta: { status: 'todo' } })}
        />

        <div className="rows">
          <AnimatePresence initial={false}>
            {items.map((item, index) => {
              const status = String(item.meta.status ?? 'todo');
              const isCurrent = room.backlogRef === item.id;

              return (
                <motion.div
                  key={item.id}
                  className="row"
                  data-current={isCurrent}
                  layout
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 24 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 30 }}
                >
                  <span className="row__index">{index + 1}</span>

                  <span className="row__text">{item.text}</span>

                  <span className="row__status" data-status={status}>
                    {STATUS_LABEL[status] ?? status}
                  </span>

                  {item.meta.estimate ? (
                    <motion.span
                      key={String(item.meta.estimate)}
                      className="row__estimate"
                      initial={{ scale: 0.4, opacity: 0, rotate: -12 }}
                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 20 }}
                    >
                      {item.meta.estimate}
                    </motion.span>
                  ) : (
                    <span className="row__estimate row__estimate--empty">–</span>
                  )}

                  {isHost && (
                    <span className="row__tools">
                      <button
                        type="button"
                        className="btn btn--sm"
                        onClick={() => actions.estimateItem(item.id)}
                        title="Send this to the poker table"
                      >
                        Estimate
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => actions.reorderItem('backlog', item.id, index - 1)}
                        disabled={index === 0}
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => actions.reorderItem('backlog', item.id, index + 1)}
                        disabled={index === items.length - 1}
                        title="Move down"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => actions.removeItem('backlog', item.id)}
                        title="Remove"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>

          {items.length === 0 && (
            <p className="column__empty">
              Nothing in the backlog yet. Add the stories you want to refine.
            </p>
          )}
        </div>

        <section className="side-lists">
          <div className="side-lists__col">
            <h3 className="rail__title">Definition of Done</h3>
            <ItemComposer
              compact
              placeholder="Add a criterion…"
              onAdd={(text) => actions.addItem('dod', text)}
            />
            <div className="column__cards">
              <AnimatePresence initial={false}>
                {room.lists.dod.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    hue={152}
                    canEdit={isHost || item.mine}
                    onEdit={(text) => actions.updateItem('dod', item.id, { text })}
                    onRemove={() => actions.removeItem('dod', item.id)}
                    onToggleDone={() => actions.updateItem('dod', item.id, { done: !item.done })}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>

          <div className="side-lists__col">
            <h3 className="rail__title">Parking lot</h3>
            <ItemComposer
              compact
              placeholder="Park a tangent for later…"
              onAdd={(text) => actions.addItem('parking', text)}
            />
            <div className="column__cards">
              <AnimatePresence initial={false}>
                {room.lists.parking.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    hue={45}
                    canEdit={isHost || item.mine}
                    onEdit={(text) => actions.updateItem('parking', item.id, { text })}
                    onRemove={() => actions.removeItem('parking', item.id)}
                    onToggleDone={() =>
                      actions.updateItem('parking', item.id, { done: !item.done })
                    }
                  />
                ))}
              </AnimatePresence>
              {room.lists.parking.length === 0 && (
                <p className="column__empty">Nothing parked.</p>
              )}
            </div>
          </div>
        </section>
      </div>

      <EmoteBar onEmote={actions.emote} />
    </div>
  );
}
