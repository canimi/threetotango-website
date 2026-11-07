export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Pull toward the cursor, capped at `max` px. */
export function magnet(px: number, py: number, r: DOMRectReadOnly, max = 8): [number, number] {
  const dx = px - (r.left + r.width / 2);
  const dy = py - (r.top + r.height / 2);
  return [clamp(dx * 0.25, -max, max), clamp(dy * 0.35, -max, max)];
}

/** Tilt in degrees (rotateX, rotateY) toward the cursor, capped at `max`. */
export function tilt(px: number, py: number, r: DOMRectReadOnly, max = 6): [number, number] {
  const nx = clamp((px - r.left) / r.width, 0, 1) - 0.5;
  const ny = clamp((py - r.top) / r.height, 0, 1) - 0.5;
  return [-ny * 2 * max, nx * 2 * max];
}
