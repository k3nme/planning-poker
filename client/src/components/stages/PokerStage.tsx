import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { StageProps } from './types';
import { getDeck } from '../../lib/decks';
import { celebrate } from '../../lib/confetti';
import { formatDuration } from '../../lib/format';
import { Console } from '../Console';
import { Hand } from '../Hand';
import { Table } from '../Table';
import { EmoteBar } from '../EmoteBar';

function Timer({ from, frozenAt }: { from: number; frozenAt: number | null }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (frozenAt) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [frozenAt]);

  return <span className="timer">{formatDuration((frozenAt ?? now) - from)}</span>;
}

export function PokerStage({ room, you, youId, isHost, actions }: StageProps) {
  const [storyDraft, setStoryDraft] = useState(room.story);
  const celebratedRound = useRef(-1);
  const deck = getDeck(room.deckId);

  useEffect(() => {
    setStoryDraft(room.story);
  }, [room.story, room.round]);

  /* One burst per unanimous round, never twice. */
  useEffect(() => {
    if (!room.revealed || !room.stats?.consensus) return;
    if (celebratedRound.current === room.round) return;
    celebratedRound.current = room.round;
    window.setTimeout(() => celebrate(undefined, 130), 480);
  }, [room.revealed, room.stats?.consensus, room.round]);

  /* Host shortcuts: space reveals, N starts the next round. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
      if (!isHost) return;
      if (event.code === 'Space' && !room.revealed) {
        event.preventDefault();
        actions.reveal();
      }
      if (event.key.toLowerCase() === 'n' && room.revealed) {
        event.preventDefault();
        actions.reset();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actions, isHost, room.revealed]);

  const voters = room.players.filter((player) => !player.spectator && player.connected);
  const canReveal = voters.length > 0 && voters.every((player) => player.hasVoted);
  const linkedItem = room.backlogRef
    ? room.lists.backlog.find((item) => item.id === room.backlogRef)
    : null;

  return (
    <>
      <div className="story">
        <span className="story__round">Round {room.round}</span>
        <input
          className="story__input"
          value={storyDraft}
          disabled={!isHost}
          placeholder={isHost ? 'What are we estimating?' : 'No story set'}
          maxLength={140}
          onChange={(event) => setStoryDraft(event.target.value)}
          onBlur={() => actions.setStory(storyDraft)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
          }}
          aria-label="Story being estimated"
        />
        {linkedItem && <span className="pill pill--accent">from backlog</span>}
        <Timer from={room.roundStartedAt} frozenAt={room.revealedAt} />
      </div>

      <Table players={room.players} deckId={room.deckId} revealed={room.revealed} youId={youId}>
        <Console
          room={room}
          isHost={isHost}
          canReveal={canReveal}
          onReveal={actions.reveal}
          onReset={actions.reset}
        />
      </Table>

      {/* When the round came from the backlog, offer to write the result back. */}
      <AnimatePresence>
        {isHost && room.revealed && linkedItem && (
          <motion.div
            className="record-bar glass"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 14 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28, delay: 0.6 }}
          >
            <span className="record-bar__text">
              Save an estimate for <strong>{linkedItem.text}</strong>
            </span>
            <div className="record-bar__cards">
              {deck.cards
                .filter((card) => card.numeric !== null)
                .map((card) => (
                  <motion.button
                    key={card.value}
                    type="button"
                    className="record-bar__card"
                    data-suggested={room.stats?.suggestion === card.value}
                    onClick={() => actions.recordEstimate(card.value)}
                    whileHover={{ y: -3, scale: 1.06 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {card.label}
                  </motion.button>
                ))}
            </div>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => actions.recordEstimate(null)}
            >
              Skip
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <EmoteBar onEmote={actions.emote} />

      <Hand
        deck={deck}
        selected={you?.vote ?? null}
        disabled={room.revealed || Boolean(you?.spectator)}
        onSelect={actions.vote}
      />
    </>
  );
}
