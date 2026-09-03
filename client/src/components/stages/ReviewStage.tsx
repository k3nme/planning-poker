import { AnimatePresence, motion } from 'motion/react';
import type { StageProps } from './types';
import { ItemCard, ItemComposer } from '../ItemCard';
import { OwnerPicker } from './RetroStage';
import { EmoteBar } from '../EmoteBar';

/**
 * Sprint review. An agenda of things to demo, each with a presenter and a
 * running feedback list, so the session produces notes rather than just talk.
 */
export function ReviewStage({ room, isHost, actions }: StageProps) {
  const agenda = room.lists.review;
  const done = agenda.filter((item) => item.done).length;
  const names = room.players.map((player) => player.name);

  return (
    <div className="board board--single">
      <header className="board__head">
        <h2 className="board__title">Sprint review</h2>
        <span className="board__spacer" />
        <span className="pill">
          {done}/{agenda.length} demoed
        </span>
        {room.sprintGoal && <span className="pill pill--accent">🎯 {room.sprintGoal}</span>}
      </header>

      <div className="board__body">
        <ItemComposer
          placeholder="Add something to demo…"
          onAdd={(text) => actions.addItem('review', text)}
        />

        <div className="rows">
          <AnimatePresence initial={false}>
            {agenda.map((item, index) => (
              <motion.div
                key={item.id}
                className="row row--agenda"
                data-done={item.done}
                layout
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ type: 'spring', stiffness: 340, damping: 30 }}
              >
                <button
                  type="button"
                  className="row__check"
                  onClick={() => actions.updateItem('review', item.id, { done: !item.done })}
                  aria-pressed={item.done}
                  title={item.done ? 'Mark as not demoed' : 'Mark as demoed'}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={item.done ? 'on' : 'off'}
                      initial={{ scale: 0.3, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.3, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      {item.done ? '✓' : index + 1}
                    </motion.span>
                  </AnimatePresence>
                </button>

                <span className="row__text">{item.text}</span>

                <OwnerPicker
                  value={String(item.meta.presenter ?? '')}
                  names={names}
                  disabled={!(item.mine || isHost)}
                  onPick={(presenter) =>
                    actions.updateItem('review', item.id, { meta: { presenter } })
                  }
                />

                <span className="row__thumbs">
                  <button
                    type="button"
                    className="thumb"
                    onClick={() => actions.voteItem('review', item.id, 1)}
                    title="Liked this"
                  >
                    👍
                  </button>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={item.votes}
                      className="thumb__count"
                      initial={{ y: -6, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 6, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      {item.votes}
                    </motion.span>
                  </AnimatePresence>
                </span>

                {(item.mine || isHost) && (
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => actions.removeItem('review', item.id)}
                    title="Remove"
                  >
                    ✕
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {agenda.length === 0 && (
            <p className="column__empty">
              Nothing on the agenda. Add what the team wants to show off.
            </p>
          )}
        </div>

        <section className="side-lists">
          <div className="side-lists__col side-lists__col--wide">
            <h3 className="rail__title">Feedback &amp; follow-ups</h3>
            <ItemComposer
              compact
              hue={199}
              placeholder="What did stakeholders say?"
              onAdd={(text) => actions.addItem('actions', text)}
            />
            <div className="column__cards column__cards--grid">
              <AnimatePresence initial={false}>
                {room.lists.actions.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    hue={199}
                    canEdit={item.mine || isHost}
                    onEdit={(text) => actions.updateItem('actions', item.id, { text })}
                    onRemove={() => actions.removeItem('actions', item.id)}
                    onToggleDone={() => actions.updateItem('actions', item.id, { done: !item.done })}
                    trailing={
                      <OwnerPicker
                        value={String(item.meta.owner ?? '')}
                        names={names}
                        disabled={!(item.mine || isHost)}
                        onPick={(owner) => actions.updateItem('actions', item.id, { meta: { owner } })}
                      />
                    }
                  />
                ))}
              </AnimatePresence>
              {room.lists.actions.length === 0 && (
                <p className="column__empty">No feedback captured yet.</p>
              )}
            </div>
          </div>
        </section>
      </div>

      <EmoteBar onEmote={actions.emote} />
    </div>
  );
}
