/**
 * Pointer effects for fine pointers only: lamp glow, water rings, hero wall ripple, magnetic buttons, episode tilt.
 * One passive pointermove listener → one rAF tick. Reads (cached rects) happen before writes; writes are
 * transforms / CSS custom properties consumed by transforms, plus one SVG attribute while rippling.
 */
import { clamp, magnet, tilt } from '../lib/pointer-math';

const fine = window.matchMedia('(pointer: fine) and (hover: hover)');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

function start(): void {
  const root = document.documentElement;
  root.classList.add('fx-on');

  // ---- lamp glow: a fixed disc moved with translate3d ----
  const lamp = document.createElement('div');
  lamp.className = 'lamp-glow';
  lamp.setAttribute('aria-hidden', 'true');
  document.body.append(lamp);

  // ---- water rings: pooled fixed-position discs, animated with WAAPI (transform/opacity only) ----
  const RING_MS = 900;
  const RING_EVERY = 120;
  const RING_MIN_MOVE = 6;
  const rings: HTMLElement[] = [];
  const ringHost = document.createElement('div');
  ringHost.className = 'ripple-rings';
  ringHost.setAttribute('aria-hidden', 'true');
  for (let n = 0; n < 8; n++) {
    const r = document.createElement('i');
    r.className = 'ripple-ring';
    ringHost.append(r);
    rings.push(r);
  }
  document.body.append(ringHost);
  let ringIdx = 0;
  let ringT = 0;
  let ringX = -1;
  let ringY = -1;
  const spawnRing = (x: number, y: number) => {
    const r = rings[ringIdx++ % rings.length];
    r.animate(
      [
        { transform: `translate3d(${x}px, ${y}px, 0) scale(0)`, opacity: 0.7 },
        { transform: `translate3d(${x}px, ${y}px, 0) scale(3)`, opacity: 0 },
      ],
      { duration: RING_MS, easing: 'cubic-bezier(0.2, 0.6, 0.3, 1)' },
    );
  };

  // ---- wall ripple ----
  const wall = document.querySelector<HTMLElement>('[data-wall]');
  const hero = document.querySelector<HTMLElement>('[data-hero]');
  const map = document.querySelector<SVGFEDisplacementMapElement>('[data-ripple-map]');
  let heroVisible = true;
  if (hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      heroVisible = e.isIntersecting;
    }).observe(hero);
  }
  let ripple = 0;
  let rippleOn = false;
  let lastScale = '';

  // ---- state ----
  let px = -1;
  let py = -1;
  let lastX = -1;
  let lastY = -1;
  let speed = 0;
  let raf = 0;
  let mag: HTMLElement | null = null;
  let magRect: DOMRect | null = null;
  let tiltEl: HTMLElement | null = null;
  let tiltRect: DOMRect | null = null;

  const release = (el: HTMLElement | null, cls: string, props: string[]) => {
    if (!el) return;
    el.classList.remove(cls);
    props.forEach((p) => el.style.removeProperty(p));
  };

  const tick = () => {
    raf = 0;
    // READS (cached; only re-measured after enter / scroll / resize)
    if (mag && !magRect) magRect = mag.getBoundingClientRect();
    if (tiltEl && !tiltRect) tiltRect = tiltEl.getBoundingClientRect();

    // WRITES
    lamp.style.transform = `translate3d(${px}px, ${py}px, 0)`;

    const now = performance.now();
    if (now - ringT >= RING_EVERY && Math.hypot(px - ringX, py - ringY) >= RING_MIN_MOVE) {
      if (ringX >= 0) spawnRing(px, py);
      ringT = now;
      ringX = px;
      ringY = py;
    }

    if (mag && magRect) {
      const [mx, my] = magnet(px, py, magRect);
      mag.style.setProperty('--mx', `${mx.toFixed(1)}px`);
      mag.style.setProperty('--my', `${my.toFixed(1)}px`);
      mag.style.setProperty('--sx', `${(clamp((px - magRect.left) / magRect.width, 0, 1) * 100).toFixed(1)}%`);
    }
    if (tiltEl && tiltRect) {
      const [rx, ry] = tilt(px, py, tiltRect);
      tiltEl.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
      tiltEl.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
      tiltEl.style.setProperty('--gx', `${(px - tiltRect.left).toFixed(0)}px`);
      tiltEl.style.setProperty('--gy', `${(py - tiltRect.top).toFixed(0)}px`);
    }

    // Ripple eases toward the pointer speed, then back to 0; the filter is detached when calm.
    if (wall && map) {
      const target = heroVisible ? clamp(speed * 0.6, 0, 24) : 0;
      ripple += (target - ripple) * (target > ripple ? 0.25 : 0.08);
      speed *= 0.85;
      const active = ripple > 0.2;
      if (active !== rippleOn) {
        rippleOn = active;
        wall.classList.toggle('is-rippling', active);
      }
      if (active) {
        const sc = ripple.toFixed(1);
        if (sc !== lastScale) map.setAttribute('scale', (lastScale = sc));
        raf = requestAnimationFrame(tick); // keep easing down without pointer events
      } else {
        ripple = 0;
        lastScale = '';
      }
    }
  };
  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(tick);
  };

  document.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      px = e.clientX;
      py = e.clientY;
      if (lastX >= 0) speed = Math.max(speed, Math.hypot(px - lastX, py - lastY));
      lastX = px;
      lastY = py;
      if (ringX < 0) {
        ringX = px;
        ringY = py;
      }
      root.classList.add('fx-pointer');
      schedule();
    },
    { passive: true },
  );
  document.documentElement.addEventListener('pointerleave', () => root.classList.remove('fx-pointer'), {
    passive: true,
  });

  document.addEventListener(
    'pointerover',
    (e) => {
      const t = e.target instanceof Element ? e.target : null;
      const m = t?.closest<HTMLElement>('[data-magnetic]') ?? null;
      if (m !== mag) {
        release(mag, 'is-magnet', ['--mx', '--my', '--sx']);
        mag = m;
        magRect = null;
        mag?.classList.add('is-magnet');
      }
      const k = t?.closest<HTMLElement>('[data-tilt]') ?? null;
      if (k !== tiltEl) {
        release(tiltEl, 'is-tilting', ['--rx', '--ry', '--gx', '--gy']);
        tiltEl = k;
        tiltRect = null;
        tiltEl?.classList.add('is-tilting');
      }
    },
    { passive: true },
  );
  const invalidate = () => {
    magRect = null;
    tiltRect = null;
  };
  // Page scroll: shift the cached rects instead of re-measuring (no forced layout while scrolling).
  // Any other scroller (e.g. the episode rail) moves its children sideways, so re-measure then.
  let lastScrollY = window.scrollY;
  const shift = (r: DOMRect | null, dy: number) => (r ? new DOMRect(r.x, r.y - dy, r.width, r.height) : r);
  window.addEventListener(
    'scroll',
    (e) => {
      if (e.target === document || e.target === document.documentElement) {
        const dy = window.scrollY - lastScrollY;
        lastScrollY = window.scrollY;
        magRect = shift(magRect, dy);
        tiltRect = shift(tiltRect, dy);
      } else {
        invalidate();
      }
    },
    { passive: true, capture: true },
  );
  window.addEventListener('resize', invalidate, { passive: true });
}

if (fine.matches && !reduce.matches) start();
