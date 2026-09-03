import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Aurora } from './components/Backdrop';
import { Landing } from './components/Landing';
import { EmoteLayer, Toasts } from './components/Overlays';
import { Room } from './components/Room';
import { useRoom } from './lib/useRoom';
import { readRoomFromLocation } from './lib/format';
import { getStoredTheme, newSessionId, storeTheme, type Theme } from './lib/session';

type Seat = { roomId: string; name: string; spectator: boolean } | null;

/** A room screen only mounts once we have a seat, so the socket opens once. */
function RoomScreen({
  seat,
  theme,
  onThemeToggle,
  onLeave,
}: {
  seat: NonNullable<Seat>;
  theme: Theme;
  onThemeToggle: () => void;
  onLeave: (reason?: string) => void;
}) {
  const onFatal = useCallback(
    (message: string) => {
      onLeave(message);
    },
    [onLeave],
  );

  const { room, you, youId, isHost, status, toasts, emotes, actions, pushToast, dismissToast } =
    useRoom({ roomId: seat.roomId, name: seat.name, spectator: seat.spectator, onFatal });

  const onCopied = useCallback(
    () => pushToast({ text: 'Invite link copied', tone: 'good', icon: '🔗' }),
    [pushToast],
  );

  return (
    <>
      {room ? (
        <Room
          room={room}
          you={you}
          youId={youId}
          isHost={isHost}
          status={status}
          actions={actions}
          theme={theme}
          onThemeToggle={onThemeToggle}
          onLeave={() => onLeave()}
          onCopied={onCopied}
        />
      ) : (
        <div className="room" style={{ display: 'grid', placeItems: 'center' }}>
          <motion.div
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <motion.span
              style={{ fontSize: 34 }}
              animate={{ rotateY: [0, 180, 360] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            >
              🂠
            </motion.span>
            <span style={{ color: 'var(--ink-mute)', fontSize: 14 }}>
              Taking a seat at {seat.roomId}…
            </span>
          </motion.div>
        </div>
      )}
      <Toasts toasts={toasts} onDismiss={dismissToast} />
      <EmoteLayer emotes={emotes} />
    </>
  );
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme());
  const [seat, setSeat] = useState<Seat>(null);
  const [initialCode, setInitialCode] = useState(() => readRoomFromLocation());
  const [notice, setNotice] = useState('');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    storeTheme(theme);
  }, [theme]);

  useEffect(() => {
    const onPop = () => {
      const code = readRoomFromLocation();
      setInitialCode(code);
      if (!code) setSeat(null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const enter = useCallback((roomId: string, name: string, spectator: boolean) => {
    setNotice('');
    setSeat({ roomId, name, spectator });
    window.history.pushState({}, '', `/r/${roomId}`);
  }, []);

  const leave = useCallback((reason?: string) => {
    setSeat(null);
    setInitialCode('');
    setNotice(reason ?? '');
    // A fresh identity so the next room doesn't inherit the old seat.
    newSessionId();
    window.history.pushState({}, '', '/');
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  const landingToasts = useMemo(
    () => (notice ? [{ id: 1, text: notice, tone: 'bad' as const, icon: '⚠️' }] : []),
    [notice],
  );

  return (
    <>
      <Aurora />
      <AnimatePresence mode="wait">
        {seat ? (
          <motion.div
            key={`room-${seat.roomId}`}
            style={{ position: 'relative', zIndex: 1, height: '100%' }}
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          >
            <RoomScreen seat={seat} theme={theme} onThemeToggle={toggleTheme} onLeave={leave} />
          </motion.div>
        ) : (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          >
            <Landing
              initialCode={initialCode}
              onEnter={enter}
              onThemeToggle={toggleTheme}
              theme={theme}
            />
            <Toasts toasts={landingToasts} onDismiss={() => setNotice('')} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
