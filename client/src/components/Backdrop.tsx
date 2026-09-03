import { motion, useReducedMotion } from 'motion/react';

type Floater = {
  label: string;
  top: string;
  left?: string;
  right?: string;
  rotate: number;
  delay: number;
};

const FLOATERS: Floater[] = [
  { label: '8', top: '14%', left: '6%', rotate: -14, delay: 0 },
  { label: '3', top: '62%', left: '9%', rotate: 11, delay: 0.8 },
  { label: '13', top: '22%', right: '7%', rotate: 16, delay: 0.4 },
  { label: '5', top: '70%', right: '11%', rotate: -9, delay: 1.2 },
];

/** Ambient aurora + grain. Purely decorative, and still on reduced motion. */
export function Aurora() {
  return (
    <div className="aurora" aria-hidden="true">
      <span className="aurora__blob aurora__blob--a" />
      <span className="aurora__blob aurora__blob--b" />
      <span className="aurora__blob aurora__blob--c" />
      <span className="aurora__grid" />
      <span className="aurora__grain" />
    </div>
  );
}

/** Slowly bobbing cards behind the landing page. */
export function Floaters() {
  const reduced = useReducedMotion();

  return (
    <div className="floaters" aria-hidden="true">
      {FLOATERS.map((floater, index) => (
        <motion.span
          key={floater.label + index}
          className="floater"
          style={{
            top: floater.top,
            left: floater.left,
            right: floater.right,
          }}
          initial={{ opacity: 0, y: 30, rotate: floater.rotate }}
          animate={
            reduced
              ? { opacity: 0.4, y: 0 }
              : {
                  opacity: 0.4,
                  y: [0, -18, 0],
                  rotate: [floater.rotate, floater.rotate + 5, floater.rotate],
                }
          }
          transition={
            reduced
              ? { duration: 0.4 }
              : {
                  duration: 9 + index,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: floater.delay,
                }
          }
        >
          {floater.label}
        </motion.span>
      ))}
    </div>
  );
}
