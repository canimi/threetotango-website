export type CharacterId = 'luka' | 'budy' | 'caddy' | 'nora';

export interface Episode {
  id: string;
  platform: 'youtube' | 'instagram';
  externalId: string;
  slug: string;
  title: string;
  description: string;
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

export function filterByCharacter(list: Episode[], c: CharacterId | 'all'): Episode[] {
  return c === 'all' ? list : list.filter((e) => e.characters.includes(c));
}

export function latestWithHero(list: Episode[]): Episode | null {
  return list.find((e) => e.heroMp4Path !== null) ?? null;
}
