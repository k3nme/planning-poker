/**
 * A tiny hand-rolled confetti burst — a few hundred bytes instead of a
 * dependency, and it respects `prefers-reduced-motion`.
 */

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  spin: number;
  size: number;
  color: string;
  shape: 'rect' | 'circle';
  life: number;
};

const PALETTE = ['#a78bfa', '#22d3ee', '#f472b6', '#facc15', '#4ade80', '#fb923c'];

let canvas: HTMLCanvasElement | null = null;
let context: CanvasRenderingContext2D | null = null;
let particles: Particle[] = [];
let frame = 0;

function ensureCanvas() {
  if (canvas) return canvas;
  canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '90',
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(canvas);
  context = canvas.getContext('2d');
  return canvas;
}

function resize() {
  if (!canvas) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * ratio;
  canvas.height = window.innerHeight * ratio;
  context?.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function tick() {
  if (!context || !canvas) return;
  context.clearRect(0, 0, window.innerWidth, window.innerHeight);

  particles = particles.filter((p) => p.life > 0 && p.y < window.innerHeight + 60);
  for (const p of particles) {
    p.vy += 0.28;
    p.vx *= 0.995;
    p.x += p.vx;
    p.y += p.vy;
    p.rotation += p.spin;
    p.life -= 1;

    context.save();
    context.translate(p.x, p.y);
    context.rotate(p.rotation);
    context.globalAlpha = Math.max(0, Math.min(1, p.life / 40));
    context.fillStyle = p.color;
    if (p.shape === 'circle') {
      context.beginPath();
      context.arc(0, 0, p.size / 2, 0, Math.PI * 2);
      context.fill();
    } else {
      context.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    }
    context.restore();
  }

  if (particles.length) {
    frame = requestAnimationFrame(tick);
  } else {
    frame = 0;
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }
}

/** Fires a celebratory burst from a point (defaults to the middle of the stage). */
export function celebrate(origin?: { x: number; y: number }, count = 110) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  ensureCanvas();
  resize();

  const x = origin?.x ?? window.innerWidth / 2;
  const y = origin?.y ?? window.innerHeight * 0.42;

  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const speed = 5 + Math.random() * 11;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 5,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.4,
      size: 6 + Math.random() * 8,
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      shape: Math.random() > 0.55 ? 'circle' : 'rect',
      life: 70 + Math.random() * 50,
    });
  }

  if (!frame) frame = requestAnimationFrame(tick);
}

window.addEventListener('resize', resize);
