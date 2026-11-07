import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { characters } from '../data/characters';

export type LineupId = 'luka' | 'budy' | 'caddy';
export const lineupIds: LineupId[] = ['luka', 'budy', 'caddy'];

export interface LineupCat {
  id: LineupId;
  /** Full-body transparent cutout, or null when it has not landed yet. */
  cutout: string | null;
  /** Round face crop, always present (fallback). */
  face: string;
}

export interface WalkSprite {
  id: LineupId;
  src: string;
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

/** Build-time: which lineup images exist. Never returns a path to a missing file. */
export function lineupCats(root: string = process.cwd()): LineupCat[] {
  return lineupIds.map((id) => ({ id, cutout: pick(root, `cast-${id}`), face: characters[id].face }));
}

const posInt = (v: unknown, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= max;

/** Build-time: walk-cycle sprites that have both a sheet and a valid json. */
export function walkSprites(root: string = process.cwd()): WalkSprite[] {
  const out: WalkSprite[] = [];
  for (const id of lineupIds) {
    const src = pick(root, `walk-${id}`);
    const jsonPath = join(castDir(root), `walk-${id}.json`);
    if (!src || !existsSync(jsonPath)) continue;
    try {
      const m = JSON.parse(readFileSync(jsonPath, 'utf8'));
      if (
        posInt(m.frames, 240) &&
        Number.isInteger(m.frames) &&
        posInt(m.frameWidth, 4096) &&
        posInt(m.frameHeight, 4096) &&
        posInt(m.fps, 60)
      ) {
        out.push({ id, src, frames: m.frames, frameWidth: m.frameWidth, frameHeight: m.frameHeight, fps: m.fps });
      }
    } catch {
      /* malformed json: skip this cat */
    }
  }
  return out;
}
