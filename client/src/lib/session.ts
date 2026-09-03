/**
 * The only things we persist are browser-local UI preferences: a display name,
 * a theme, and a per-tab identity used to reclaim your seat after a refresh.
 * Nothing ever reaches a database — the server keeps rooms in memory alone.
 */

const NAME_KEY = 'pp:name';
const THEME_KEY = 'pp:theme';
const SESSION_KEY = 'pp:session';

const safeGet = (storage: Storage, key: string): string | null => {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

const safeSet = (storage: Storage, key: string, value: string) => {
  try {
    storage.setItem(key, value);
  } catch {
    /* private mode — preferences just won't stick */
  }
};

const randomId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return `s-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }
};

/** Stable for the lifetime of the tab, so a refresh keeps your seat and vote. */
export function getSessionId(): string {
  let id = safeGet(sessionStorage, SESSION_KEY);
  if (!id) {
    id = randomId();
    safeSet(sessionStorage, SESSION_KEY, id);
  }
  return id;
}

export function newSessionId(): string {
  const id = randomId();
  safeSet(sessionStorage, SESSION_KEY, id);
  return id;
}

export const getStoredName = () => safeGet(localStorage, NAME_KEY) ?? '';
export const storeName = (name: string) => safeSet(localStorage, NAME_KEY, name);

export type Theme = 'dark' | 'light';

export function getStoredTheme(): Theme {
  const stored = safeGet(localStorage, THEME_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function storeTheme(theme: Theme) {
  safeSet(localStorage, THEME_KEY, theme);
}

const ADJECTIVES = [
  'Swift', 'Calm', 'Bold', 'Lucky', 'Quiet', 'Bright', 'Clever', 'Wired',
  'Nimble', 'Cosmic', 'Sly', 'Brave',
];
const NOUNS = [
  'Otter', 'Falcon', 'Comet', 'Panda', 'Fox', 'Heron', 'Lynx', 'Koala',
  'Badger', 'Raven', 'Tapir', 'Moth',
];

export const suggestName = () =>
  `${ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]} ${
    NOUNS[Math.floor(Math.random() * NOUNS.length)]
  }`;
