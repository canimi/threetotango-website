export type CharacterId = 'luka' | 'budy' | 'caddy' | 'nora';

export interface Episode {
  id: string;
  platform: 'youtube' | 'instagram';
  externalId: string;
  slug: string;
  title: string;
  description: string;
  /** Clean web meta description written at import (empty until generated). */
  seoDescription?: string;
  /** Short episode premise written at import from the caption (empty until generated). */
  summary?: string;
  publishedAt: string;
  thumbnailUrl: string;
  videoUrl: string;
  heroMp4Path: string | null;
  characters: CharacterId[];
}

function normalize(data: unknown): Episode[] | null {
  if (!Array.isArray(data)) return null;
  return [...(data as Episode[])].sort(
    (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
  );
}

/** Reads the episode list from a local JSON file. Returns null if missing/unreadable/invalid. */
async function readEpisodesFile(file: string): Promise<Episode[] | null> {
  try {
    const { readFile } = await import('node:fs/promises');
    const list = normalize(JSON.parse(await readFile(file, 'utf8')));
    if (!list) console.warn(`[episodes] ${file} is not a JSON array`);
    return list;
  } catch (err) {
    console.warn('[episodes] cannot read file:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Build-time load of the episode list. Never throws; returns [] on any failure.
 * If `file` is given and readable, it wins (Docker build: the feed is baked in with ADD so the
 * layer cache is invalidated when the feed changes). Otherwise falls back to `url`.
 */
export async function fetchEpisodes(
  url: string | undefined,
  fetchFn: typeof fetch = fetch,
  file?: string,
): Promise<Episode[]> {
  if (file) {
    const fromFile = await readEpisodesFile(file);
    if (fromFile) return fromFile;
  }
  if (!url) return [];
  try {
    const res = await fetchFn(url);
    if (!res.ok) {
      console.warn(`[episodes] API responded ${res.status}`);
      return [];
    }
    const list = normalize(await res.json());
    if (!list) {
      console.warn('[episodes] API response is not an array');
      return [];
    }
    return list;
  } catch (err) {
    console.warn('[episodes] fetch failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

const CATS: CharacterId[] = ['luka', 'budy', 'caddy'];

/**
 * Who is in an episode. The automatic tagger reads only the caption, which rarely names the cats,
 * so most episodes come back untagged. The series is built on all three cats being in the house:
 * an episode with no cat tagged counts as starring Luka, Budy and Caddy (Nora is kept if tagged).
 */
export function castOf(e: Episode): CharacterId[] {
  const tagged = e.characters.filter((c): c is CharacterId => (CATS as string[]).includes(c) || c === 'nora');
  if (tagged.some((c) => CATS.includes(c))) return tagged;
  return [...CATS, ...tagged];
}

export function filterByCharacter(list: Episode[], c: CharacterId | 'all'): Episode[] {
  return c === 'all' ? list : list.filter((e) => castOf(e).includes(c));
}

export function latestWithHero(list: Episode[]): Episode | null {
  return list.find((e) => e.heroMp4Path !== null) ?? null;
}
