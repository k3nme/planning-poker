import { AnimatePresence, motion } from 'motion/react';
import type { StageProps } from './types';
import type { Item } from '../../types';
import { RETRO_PHASES, RETRO_TEMPLATE_LIST, getRetroTemplate } from '../../lib/templates';
import { ItemCard, ItemComposer } from '../ItemCard';
import { EmoteBar } from '../EmoteBar';

/**
 * The retrospective board.
 *
 * Runs in four phases. During `collect` everyone writes privately — other
 * people's cards arrive from the server with their text stripped, so the board
 * genuinely cannot be read early. `reveal` turns them all over, `vote` opens
 * dot voting with a per-person budget, and `act` sorts by votes and puts the
 * action list alongside so the discussion ends in commitments.
 */
export function RetroStage({ room, youId, isHost, actions }: StageProps) {
  const template = getRetroTemplate(room.retro.template);
  const { phase, anonymous, votesPerPerson, votesSpent } = room.retro;
  const voting = phase === 'vote';

  const byColumn = (columnId: string) =>
    room.lists.retro
      .filter((item) => item.column === columnId)
      .sort((a, b) => (phase === 'act' || phase === 'vote' ? b.votes - a.votes : a.createdAt - b.createdAt));

  const topCards: Item[] = [...room.lists.retro].sort((a, b) => b.votes - a.votes).slice(0, 5);

  return (
    <div className="board">
      <header className="board__head">
        <div className="phase-track" role="group" aria-label="Retro phase">
          {RETRO_PHASES.map((step, index) => {
            const active = step.id === phase;
            const past = RETRO_PHASES.findIndex((entry) => entry.id === phase) > index;
            return (
              <button
                key={step.id}
                type="button"
                className="phase-step"
                data-active={active}
                data-past={past}
                disabled={!isHost}
                onClick={() => actions.setRetroPhase(step.id)}
                title={step.hint}
              >
                {active && (
                  <motion.span
                    layoutId="phase-pill"
                    className="phase-step__pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="phase-step__body">
                  <span className="phase-step__index">{index + 1}</span>
                  {step.label}
                </span>
              </button>
            );
          })}
        </div>

        <span className="board__spacer" />

        {voting && (
          <motion.span
            className="pill pill--accent"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            {votesPerPerson - votesSpent} of {votesPerPerson} dots left
          </motion.span>
        )}

        {isHost && (
          <>
            <select
              className="mini-select"
              value={template.id}
              onChange={(event) => actions.setRetroTemplate(event.target.value)}
              aria-label="Retro template"
            >
              {RETRO_TEMPLATE_LIST.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => actions.setRetroSettings({ anonymous: !anonymous })}
              title="Show or hide who wrote each card"
            >
              {anonymous ? '🕶 Anonymous' : '👤 Named'}
            </button>
          </>
        )}
      </header>

      {phase === 'collect' && (
        <motion.p
          className="board__note"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Write freely — nobody else can read your cards until the host turns them over.
          <strong> {room.retro.cardCount}</strong> on the board so far.
        </motion.p>
      )}

      <div className="columns" data-count={template.columns.length}>
        {template.columns.map((column) => {
          const items = byColumn(column.id);
          return (
            <section
              className="column"
              key={column.id}
              style={{ '--hue': String(column.hue) } as React.CSSProperties}
            >
              <header className="column__head">
                <span className="column__icon">{column.icon}</span>
                <span className="column__label">{column.label}</span>
                <span className="column__count">{items.length}</span>
              </header>
              {column.hint && <p className="column__hint">{column.hint}</p>}

              {phase === 'collect' && (
                <ItemComposer
                  hue={column.hue}
                  placeholder={`Add to ${column.label.toLowerCase()}…`}
                  onAdd={(text) => actions.addItem('retro', text, { column: column.id })}
                />
              )}

              <div className="column__cards">
                <AnimatePresence initial={false}>
                  {items.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      hue={column.hue}
                      voting={voting}
                      authorLabel={
                        item.mine ? item.authorName : anonymous ? 'Anonymous' : item.authorName
                      }
                      canEdit={item.mine || isHost}
                      onVote={(delta) => actions.voteItem('retro', item.id, delta)}
                      onEdit={(text) => actions.updateItem('retro', item.id, { text })}
                      onRemove={() => actions.removeItem('retro', item.id)}
                    />
                  ))}
                </AnimatePresence>
                {items.length === 0 && phase !== 'collect' && (
                  <p className="column__empty">Nothing here</p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <AnimatePresence>
        {phase === 'act' && (
          <motion.section
            className="actions-panel glass"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="actions-panel__col">
              <h3 className="rail__title">Most votes</h3>
              {topCards.filter((item) => item.votes > 0).length === 0 ? (
                <p className="column__empty">No dots were spent.</p>
              ) : (
                topCards
                  .filter((item) => item.votes > 0)
                  .map((item) => (
                    <div className="top-card" key={item.id}>
                      <span className="top-card__votes">{item.votes}</span>
                      <span className="top-card__text">{item.text}</span>
                      {isHost && (
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => actions.addItem('actions', item.text)}
                          title="Turn this into an action item"
                        >
                          → action
                        </button>
                      )}
                    </div>
                  ))
              )}
            </div>

            <div className="actions-panel__col">
              <h3 className="rail__title">Action items</h3>
              <ItemComposer
                compact
                placeholder="What will we actually change?"
                onAdd={(text) => actions.addItem('actions', text)}
              />
              <div className="column__cards">
                <AnimatePresence initial={false}>
                  {room.lists.actions.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      hue={199}
                      canEdit={item.mine || isHost}
                      onEdit={(text) => actions.updateItem('actions', item.id, { text })}
                      onRemove={() => actions.removeItem('actions', item.id)}
                      onToggleDone={() =>
                        actions.updateItem('actions', item.id, { done: !item.done })
                      }
                      trailing={
                        <OwnerPicker
                          value={String(item.meta.owner ?? '')}
                          names={room.players.map((player) => player.name)}
                          onPick={(owner) =>
                            actions.updateItem('actions', item.id, { meta: { owner } })
                          }
                          disabled={!(item.mine || isHost)}
                        />
                      }
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <EmoteBar onEmote={actions.emote} />
      <span className="sr-only" aria-live="polite">
        Retro phase: {phase}. {youId ? '' : ''}
      </span>
    </div>
  );
}

/** Assigns an owner to an action item from the people in the room. */
export function OwnerPicker({
  value,
  names,
  onPick,
  disabled,
}: {
  value: string;
  names: string[];
  onPick: (owner: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      className="owner-picker"
      value={value}
      disabled={disabled}
      onChange={(event) => onPick(event.target.value)}
      aria-label="Owner"
      title="Owner"
    >
      <option value="">Unassigned</option>
      {names.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  );
}
