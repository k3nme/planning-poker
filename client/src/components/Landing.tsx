import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { DECK_LIST, DEFAULT_DECK, getDeck } from '../lib/decks';
import { getStoredName, storeName, suggestName } from '../lib/session';
import { Floaters } from './Backdrop';
import { PlayingCard } from './PlayingCard';

type Mode = 'create' | 'join';

type Props = {
  initialCode: string;
  onEnter: (roomId: string, name: string, spectator: boolean) => void;
  onThemeToggle: () => void;
  theme: 'dark' | 'light';
};

const FEATURES = [
  {
    icon: '⚡',
    title: 'Live in a second',
    body: 'Share a six-character code. No accounts, no invites, no install.',
  },
  {
    icon: '🕶️',
    title: 'Nothing is stored',
    body: 'Rooms live in memory. When the last person leaves, they are gone.',
  },
  {
    icon: '🎴',
    title: 'Five decks',
    body: 'Fibonacci, t-shirts, powers of two — switch mid-session anytime.',
  },
];

const TITLE_WORDS = ['Estimate', 'together,'];

const PREVIEW_SEATS = [
  { name: 'Ada', value: '5' },
  { name: 'Bo', value: '8' },
  { name: 'Cy', value: '5' },
];

/** A miniature round playing on loop: three cards face down, then face up. */
function HeroPreview() {
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setFlipped((value) => !value), 2800);
    return () => window.clearInterval(id);
  }, []);

  return (
    <motion.div
      className="hero__preview"
      aria-hidden="true"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="hero__preview-seats">
        {PREVIEW_SEATS.map((seat, index) => (
          <span className="hero__preview-seat" key={seat.name}>
            <PlayingCard
              deckId="fibonacci"
              value={seat.value}
              faceDown={!flipped}
              corners={false}
              flipDelay={index * 0.12}
            />
            <span className="hero__preview-name">{seat.name}</span>
          </span>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={flipped ? 'revealed' : 'hidden'}
          className="hero__preview-caption"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.24 }}
        >
          {flipped ? 'Average 6 · median 5' : 'Three votes, still hidden'}
        </motion.span>
      </AnimatePresence>
    </motion.div>
  );
}

function CodeInput({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const cells = Array.from({ length: 6 }, (_, index) => value[index] ?? '');

  return (
    <div className="code-wrap">
      <div className="code-input" onClick={() => ref.current?.focus()}>
        {cells.map((char, index) => {
          const active = focused && (index === value.length || (index === 5 && value.length === 6));
          return (
            <motion.div
              key={index}
              className="code-input__cell"
              data-active={active}
              animate={char ? { scale: [0.86, 1.06, 1] } : { scale: 1 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            >
              {char || (active ? <span className="code-input__caret" /> : null)}
            </motion.div>
          );
        })}
      </div>
      <input
        ref={ref}
        className="code-input__field"
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, '')
              .slice(0, 6),
          )
        }
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        aria-label="Room code"
      />
    </div>
  );
}

export function Landing({ initialCode, onEnter, onThemeToggle, theme }: Props) {
  const [mode, setMode] = useState<Mode>(initialCode ? 'join' : 'create');
  const [name, setName] = useState(() => getStoredName() || suggestName());
  const [roomName, setRoomName] = useState('Sprint planning');
  const [deckId, setDeckId] = useState(DEFAULT_DECK);
  const [code, setCode] = useState(initialCode);
  const [spectator, setSpectator] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const deck = useMemo(() => getDeck(deckId), [deckId]);

  useEffect(() => {
    if (initialCode) {
      setCode(initialCode);
      setMode('join');
    }
  }, [initialCode]);

  const enter = (roomId: string) => {
    const trimmed = name.trim() || suggestName();
    storeName(trimmed);
    onEnter(roomId, trimmed, spectator);
  };

  const handleCreate = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: roomName, deckId }),
      });
      if (!response.ok) throw new Error('Could not create the room.');
      const room = (await response.json()) as { id: string };
      enter(room.id);
    } catch {
      setError('Could not reach the server. Is it running?');
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    if (code.length !== 6) {
      setError('Room codes are six characters.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/rooms/${code}`);
      if (response.status === 404) {
        setError('No room with that code — it may have ended.');
        setBusy(false);
        return;
      }
      enter(code);
    } catch {
      setError('Could not reach the server. Is it running?');
      setBusy(false);
    }
  };

  return (
    <div className="landing">
      <Floaters />

      <nav className="landing__nav">
        <span className="brand">
          <span className="brand__mark">♠</span>
          Planning Poker
        </span>
        <button
          type="button"
          className="btn btn--icon btn--ghost tip"
          data-tip={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          onClick={onThemeToggle}
          aria-label="Toggle colour theme"
        >
          {theme === 'dark' ? '☾' : '☀'}
        </button>
      </nav>

      <div className="landing__main">
        <header className="landing__hero">
        <motion.span
          className="eyebrow"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="dot dot--live" />
          No sign-up · nothing stored · instant rooms
        </motion.span>

        <h1 className="hero__title">
          {TITLE_WORDS.map((word, index) => (
            <motion.span
              key={word}
              style={{ display: 'inline-block', marginRight: '0.24em' }}
              initial={{ opacity: 0, y: 26, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.7, delay: 0.06 * index, ease: [0.16, 1, 0.3, 1] }}
            >
              {word}
            </motion.span>
          ))}
          <motion.em
            initial={{ opacity: 0, y: 26, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.7, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
            style={{ display: 'inline-block' }}
          >
            honestly
          </motion.em>
        </h1>

        <motion.p
          className="hero__sub"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.24, ease: [0.16, 1, 0.3, 1] }}
        >
          Everyone picks a card in secret, then they all turn over at once. No anchoring,
          no loudest-voice-wins, no spreadsheet afterwards.
        </motion.p>

          <HeroPreview />
        </header>

        <motion.section
          className="panel glass"
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="segments panel__tabs" role="tablist" aria-label="Create or join">
          {(['create', 'join'] as Mode[]).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              className="segments__btn"
              data-active={mode === value}
              onClick={() => {
                setMode(value);
                setError('');
              }}
            >
              {mode === value && (
                <motion.span
                  layoutId="tab-thumb"
                  className="segments__thumb"
                  style={{ inset: 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                />
              )}
              <span style={{ position: 'relative' }}>
                {value === 'create' ? 'Start a room' : 'Join a room'}
              </span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.form
            key={mode}
            className="panel__form"
            initial={{ opacity: 0, x: mode === 'create' ? -18 : 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: mode === 'create' ? 18 : -18 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            onSubmit={(event) => {
              event.preventDefault();
              if (busy) return;
              if (mode === 'create') void handleCreate();
              else void handleJoin();
            }}
          >
            {mode === 'join' ? (
              <label className="field">
                <span className="field__label">Room code</span>
                <CodeInput value={code} onChange={setCode} />
              </label>
            ) : (
              <label className="field">
                <span className="field__label">What are you planning?</span>
                <input
                  className="input"
                  value={roomName}
                  onChange={(event) => setRoomName(event.target.value.slice(0, 40))}
                  placeholder="Sprint 42 planning"
                  maxLength={40}
                />
              </label>
            )}

            <label className="field">
              <span className="field__label">Your name</span>
              <input
                className="input"
                value={name}
                onChange={(event) => setName(event.target.value.slice(0, 24))}
                placeholder="Ada"
                maxLength={24}
              />
            </label>

            {mode === 'create' && (
              <div className="field">
                <span className="field__label">Deck</span>
                <div className="decks">
                  {DECK_LIST.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className="deck-chip"
                      data-active={deckId === option.id}
                      onClick={() => setDeckId(option.id)}
                    >
                      {deckId === option.id && (
                        <motion.span
                          layoutId="deck-glow"
                          className="deck-chip__glow"
                          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                        />
                      )}
                      <span style={{ position: 'relative' }}>{option.name}</span>
                    </button>
                  ))}
                </div>
                <div className="deck-preview">
                  <span className="deck-preview__cards">
                    <AnimatePresence mode="popLayout" initial={false}>
                      {deck.cards.slice(0, 7).map((card, index) => (
                        <motion.span
                          key={`${deck.id}-${card.value}`}
                          className="deck-preview__card"
                          initial={{ opacity: 0, y: 10, rotate: -8 }}
                          animate={{ opacity: 1, y: 0, rotate: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ delay: index * 0.03, duration: 0.28 }}
                        >
                          {card.label}
                        </motion.span>
                      ))}
                    </AnimatePresence>
                  </span>
                  <span style={{ marginLeft: 12 }}>{deck.hint}</span>
                </div>
              </div>
            )}

            <label
              className="switch-row"
              style={{ cursor: 'pointer' }}
              onClick={(event) => {
                event.preventDefault();
                setSpectator((value) => !value);
              }}
            >
              <span>
                <span className="switch-row__text">Join as an observer</span>
                <span className="switch-row__hint">Watch the round without casting a vote.</span>
              </span>
              <span className="switch" data-on={spectator} role="switch" aria-checked={spectator}>
                <motion.span
                  className="switch__knob"
                  layout
                  transition={{ type: 'spring', stiffness: 620, damping: 36 }}
                />
              </span>
            </label>

            <AnimatePresence>
              {error && (
                <motion.p
                  className="panel__error"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              className="btn btn--primary btn--lg btn--block"
              disabled={busy}
              whileHover={{ scale: busy ? 1 : 1.02 }}
              whileTap={{ scale: busy ? 1 : 0.98 }}
              transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            >
              <span style={{ position: 'relative', zIndex: 1 }}>
                {busy ? 'Shuffling…' : mode === 'create' ? 'Deal me in' : 'Take a seat'}
              </span>
            </motion.button>
          </motion.form>
        </AnimatePresence>
        </motion.section>
      </div>

      <div className="features">
        {FEATURES.map((feature, index) => (
          <motion.article
            key={feature.title}
            className="feature"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45 + index * 0.08, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ y: -4 }}
          >
            <span className="feature__icon">{feature.icon}</span>
            <h2 className="feature__title">{feature.title}</h2>
            <p className="feature__body">{feature.body}</p>
          </motion.article>
        ))}
      </div>

      <p className="landing__foot">
        Rooms are swept from memory a few minutes after the last person leaves.
      </p>
    </div>
  );
}
