import { motion } from 'motion/react';
import type { ActivityId } from '../types';
import { ACTIVITIES } from '../lib/templates';

/**
 * The ceremony switcher. Only the host drives it — everyone else follows,
 * which is what keeps a distributed team looking at the same thing.
 */
export function ActivityBar({
  current,
  isHost,
  onSelect,
  badges,
}: {
  current: ActivityId;
  isHost: boolean;
  onSelect: (activity: ActivityId) => void;
  badges: Partial<Record<ActivityId, number>>;
}) {
  return (
    <nav className="activity-bar" aria-label="Ceremony">
      {ACTIVITIES.map((activity) => {
        const active = activity.id === current;
        const badge = badges[activity.id];

        return (
          <button
            key={activity.id}
            type="button"
            className="activity-tab"
            data-active={active}
            disabled={!isHost && !active}
            onClick={() => onSelect(activity.id)}
            title={isHost ? activity.hint : `${activity.hint} — the host chooses`}
            aria-current={active}
          >
            {active && (
              <motion.span
                layoutId="activity-pill"
                className="activity-tab__pill"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="activity-tab__body">
              <span className="activity-tab__icon">{activity.icon}</span>
              <span className="activity-tab__name">{activity.name}</span>
              {badge ? <span className="activity-tab__badge">{badge}</span> : null}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
