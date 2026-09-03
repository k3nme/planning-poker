import type { Activity, HealthDimension, HealthLevel, RetroTemplate, StandupPrompt } from '../types';

/** Mirrors server/src/templates.mjs. */

export const ACTIVITIES: Activity[] = [
  { id: 'poker', name: 'Estimate', icon: '♠', hint: 'Planning poker' },
  { id: 'backlog', name: 'Backlog', icon: '📋', hint: 'Refinement' },
  { id: 'standup', name: 'Standup', icon: '☀', hint: 'Daily scrum' },
  { id: 'retro', name: 'Retro', icon: '🔁', hint: 'Retrospective' },
  { id: 'review', name: 'Review', icon: '🎬', hint: 'Sprint review' },
  { id: 'health', name: 'Health', icon: '💓', hint: 'Team health check' },
];

export const RETRO_TEMPLATES: Record<string, RetroTemplate> = {
  classic: {
    id: 'classic',
    name: 'Went well / To improve',
    columns: [
      { id: 'good', label: 'Went well', icon: '🌱', hue: 152 },
      { id: 'bad', label: 'To improve', icon: '🌧', hue: 24 },
      { id: 'ideas', label: 'Ideas', icon: '💡', hue: 45 },
    ],
  },
  startStopContinue: {
    id: 'startStopContinue',
    name: 'Start / Stop / Continue',
    columns: [
      { id: 'start', label: 'Start', icon: '▶', hue: 152 },
      { id: 'stop', label: 'Stop', icon: '■', hue: 0 },
      { id: 'continue', label: 'Continue', icon: '↻', hue: 199 },
    ],
  },
  fourLs: {
    id: 'fourLs',
    name: 'Four Ls',
    columns: [
      { id: 'liked', label: 'Liked', icon: '💚', hue: 152 },
      { id: 'learned', label: 'Learned', icon: '🎓', hue: 199 },
      { id: 'lacked', label: 'Lacked', icon: '🕳', hue: 24 },
      { id: 'longed', label: 'Longed for', icon: '✨', hue: 288 },
    ],
  },
  madSadGlad: {
    id: 'madSadGlad',
    name: 'Mad / Sad / Glad',
    columns: [
      { id: 'mad', label: 'Mad', icon: '😠', hue: 0 },
      { id: 'sad', label: 'Sad', icon: '😔', hue: 220 },
      { id: 'glad', label: 'Glad', icon: '😄', hue: 45 },
    ],
  },
  sailboat: {
    id: 'sailboat',
    name: 'Sailboat',
    columns: [
      { id: 'wind', label: 'Wind', icon: '💨', hue: 199, hint: 'What pushes us forward' },
      { id: 'anchor', label: 'Anchors', icon: '⚓', hue: 24, hint: 'What holds us back' },
      { id: 'rocks', label: 'Rocks', icon: '🪨', hue: 0, hint: 'Risks ahead' },
      { id: 'island', label: 'Island', icon: '🏝', hue: 152, hint: 'Where we are heading' },
    ],
  },
};

export const RETRO_TEMPLATE_LIST = Object.values(RETRO_TEMPLATES);

export const getRetroTemplate = (id: string): RetroTemplate =>
  RETRO_TEMPLATES[id] ?? RETRO_TEMPLATES.classic;

export const RETRO_PHASES = [
  { id: 'collect', label: 'Collect', hint: 'Everyone writes in private' },
  { id: 'reveal', label: 'Discuss', hint: 'Cards are turned over' },
  { id: 'vote', label: 'Vote', hint: 'Spend your dots' },
  { id: 'act', label: 'Actions', hint: 'Agree what changes' },
] as const;

export const HEALTH_DIMENSIONS: HealthDimension[] = [
  { id: 'value', label: 'Delivering value', hint: 'We ship things people actually want.' },
  { id: 'process', label: 'Suitable process', hint: 'The way we work helps more than it hurts.' },
  { id: 'codebase', label: 'Codebase health', hint: 'We are proud of the code we work in.' },
  { id: 'release', label: 'Easy to release', hint: 'Shipping is boring and safe.' },
  { id: 'learning', label: 'Learning', hint: 'We are getting better at our craft.' },
  { id: 'speed', label: 'Speed', hint: 'We get things done without waiting around.' },
  { id: 'teamwork', label: 'Teamwork', hint: 'We work as one team, not as individuals.' },
  { id: 'fun', label: 'Fun', hint: 'We enjoy working together.' },
];

export const HEALTH_LEVELS: HealthLevel[] = [
  { id: 'green', label: 'Good', icon: '😀', score: 2, hue: 152 },
  { id: 'amber', label: 'Mixed', icon: '😐', score: 1, hue: 45 },
  { id: 'red', label: 'Poor', icon: '🙁', score: 0, hue: 0 },
];

export const STANDUP_PROMPTS: StandupPrompt[] = [
  { id: 'done', label: 'Finished since yesterday', icon: '✅' },
  { id: 'today', label: 'On today', icon: '🎯' },
  { id: 'blocked', label: 'In my way', icon: '🚧' },
];

/** Handy timeboxes offered by the timer control, in seconds. */
export const TIMEBOXES = [
  { label: '1 min', seconds: 60 },
  { label: '5 min', seconds: 300 },
  { label: '10 min', seconds: 600 },
  { label: '15 min', seconds: 900 },
];
