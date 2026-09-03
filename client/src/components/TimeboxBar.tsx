import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { TIMEBOXES } from '../lib/templates';
import { formatDuration } from '../lib/format';

type Props = {
  timer: { label: string; endsAt: number | null; duration: number };
  sprintGoal: string;
  isHost: boolean;
  onStart: (seconds: number, label: string) => void;
  onStop: () => void;
  onGoal: (goal: string) => void;
  activityName: string;
};

/**
 * Sprint goal on the left, shared timebox on the right. Both live above every
 * ceremony because both are things the whole team should keep glancing at.
 */
export function TimeboxBar({
  timer,
  sprintGoal,
  isHost,
  onStart,
  onStop,
  onGoal,
  activityName,
}: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [goalDraft, setGoalDraft] = useState(sprintGoal);
  const [picking, setPicking] = useState(false);

  useEffect(() => setGoalDraft(sprintGoal), [sprintGoal]);

  useEffect(() => {
    if (!timer.endsAt) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [timer.endsAt]);

  const remaining = timer.endsAt ? timer.endsAt - now : 0;
  const running = Boolean(timer.endsAt) && remaining > 0;
  const expired = Boolean(timer.endsAt) && remaining <= 0;
  const ratio = timer.duration ? Math.max(0, remaining / (timer.duration * 1000)) : 0;

  return (
    <div className="timebox-bar">
      <span className="timebox-bar__goal-label" title="Sprint goal">
        🎯
      </span>
      <input
        className="timebox-bar__goal"
        value={goalDraft}
        disabled={!isHost}
        placeholder={isHost ? 'Set a sprint goal…' : 'No sprint goal set'}
        maxLength={140}
        onChange={(event) => setGoalDraft(event.target.value)}
        onBlur={() => goalDraft !== sprintGoal && onGoal(goalDraft)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
        }}
        aria-label="Sprint goal"
      />

      <AnimatePresence mode="popLayout" initial={false}>
        {(running || expired) && (
          <motion.div
            key="clock"
            className="timebox"
            data-expired={expired}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          >
            <svg className="timebox__ring" viewBox="0 0 36 36" aria-hidden="true">
              <circle cx="18" cy="18" r="15" fill="none" stroke="var(--surface-3)" strokeWidth="3" />
              <motion.circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke={expired ? '#f87171' : 'var(--violet)'}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 15}
                animate={{ strokeDashoffset: 2 * Math.PI * 15 * (1 - ratio) }}
                transition={{ ease: 'linear', duration: 0.25 }}
                transform="rotate(-90 18 18)"
              />
            </svg>
            <span className="timebox__time">
              {expired ? "Time's up" : formatDuration(remaining)}
            </span>
            <span className="timebox__label">{timer.label}</span>
            {isHost && (
              <button type="button" className="icon-btn" onClick={onStop} title="Clear the timer">
                ✕
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {isHost && !running && (
        <div className="timebox-start">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setPicking((value) => !value)}
          >
            ⏱ Timebox
          </button>
          <AnimatePresence>
            {picking && (
              <motion.div
                className="timebox-start__menu glass"
                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.96 }}
                transition={{ duration: 0.16 }}
              >
                {TIMEBOXES.map((box) => (
                  <button
                    key={box.seconds}
                    type="button"
                    className="timebox-start__option"
                    onClick={() => {
                      onStart(box.seconds, activityName);
                      setPicking(false);
                    }}
                  >
                    {box.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
