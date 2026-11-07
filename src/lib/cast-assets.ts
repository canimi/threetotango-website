import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { characters } from '../data/characters';

export type LineupId = 'luka' | 'budy' | 'caddy';
export const lineupIds: LineupId[] = ['luka', 'budy', 'caddy'];

export interface LineupCat {
  id: LineupId;
  /** Full-body transparent cutout, or null when it has not landed yet. */
  cutout: string | null;
  /** Intrinsic size of the cutout (for width/height attributes and aspect ratio). */
  width?: number;
  height?: number;
  /** Round face crop, always present (fallback). */
  face: string;
}

export interface WalkSprite {
  id: LineupId;
  src: string;
  /** Optional @2x sheet with the same frame count (used through image-set). */
  src2x?: string;
  frames: number;
  frameWidth: number;
  frameHeight: number;
  fps: number;
}

const castDir = (root: string) => join(root, 'public', 'img', 'cast');

/** First existing file among `<base>.webp`, `<base>.png` → public URL, else null. */
function pick(root: string, base: string): string | null {
  for (const ext of ['webp', 'png']) {
    if (existsSync(join(castDir(root), `${base}.${ext}`))) return `/img/cast/${base}.${ext}`;
  }
  return null;
}

/** Reads width/height from a PNG or WebP header; null if unknown. */
export function imageSize(file: string): { width: number; height: number } | null {
  let b: Buffer;
  try {
    b = readFileSync(file);
  } catch {
    return null;
  }
  if (b.length >= 24 && b.readUInt32BE(0) === 0x89504e47) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b.length >= 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const kind = b.toString('ascii', 12, 16);
    if (kind === 'VP8X') return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
    if (kind === 'VP8L') {
      const [b0, b1, b2, b3] = [b[21], b[22], b[23], b[24]];
      return { width: 1 + (b0 | ((b1 & 0x3f) << 8)), height: 1 + ((b1 >> 6) | (b2 << 2) | ((b3 & 0x0f) << 10)) };
    }
    if (kind === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  }
  return null;
}

/** Build-time: which lineup images exist. Never returns a path to a missing file. */
export function lineupCats(root: string = process.cwd()): LineupCat[] {
  return lineupIds.map((id) => {
    const cutout = pick(root, `cast-${id}`);
    const size = cutout ? imageSize(join(root, 'public', cutout)) : null;
    return { id, cutout, face: characters[id].face, ...(size ?? {}) };
  });
}

const posInt = (v: unknown, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= max;

/** Build-time: walk-cycle sprites that have both a sheet and a valid json. */
export function walkSprites(root: string = process.cwd()): WalkSprite[] {
  const out: WalkSprite[] = [];
  const meta = (name: string) => {
    const jsonPath = join(castDir(root), `${name}.json`);
    if (!existsSync(jsonPath)) return null;
    try {
      const m = JSON.parse(readFileSync(jsonPath, 'utf8'));
      const ok =
        posInt(m.frames, 240) &&
        Number.isInteger(m.frames) &&
        posInt(m.frameWidth, 4096) &&
        posInt(m.frameHeight, 4096) &&
        posInt(m.fps, 60);
      return ok ? (m as { frames: number; frameWidth: number; frameHeight: number; fps: number }) : null;
    } catch {
      return null; // malformed json: skip
    }
  };
  for (const id of lineupIds) {
    const src = pick(root, `walk-${id}`);
    const m = src ? meta(`walk-${id}`) : null;
    if (!src || !m) continue;
    const sprite: WalkSprite = { id, src, frames: m.frames, frameWidth: m.frameWidth, frameHeight: m.frameHeight, fps: m.fps };
    const src2x = pick(root, `walk-${id}@2x`);
    const m2 = src2x ? meta(`walk-${id}@2x`) : null;
    if (src2x && m2 && m2.frames === m.frames) sprite.src2x = src2x;
    out.push(sprite);
  }
  return out;
}
