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

/** Build-time fetch of the episode list. Never throws; returns [] on any failure. */
export async function fetchEpisodes(
  url: string | undefined,
  fetchFn: typeof fetch = fetch,
): Promise<Episode[]> {
  if (!url) return [];
  try {
    const res = await fetchFn(url);
    if (!res.ok) {
      console.warn(`[episodes] API responded ${res.status}`);
      return [];
    }
    const data: unknown = await res.json();
    if (!Array.isArray(data)) {
      console.warn('[episodes] API response is not an array');
      return [];
    }
    return [...(data as Episode[])].sort(
      (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
    );
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
