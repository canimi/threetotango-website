import { fetchEpisodes, type Episode } from './episodes';

let cache: Promise<Episode[]> | undefined;

/** Build-time episode list, fetched once per build. */
export function getEpisodes(): Promise<Episode[]> {
  cache ??= fetchEpisodes(process.env.EPISODES_API_URL ?? import.meta.env.EPISODES_API_URL);
  return cache;
}

export function basename(p: string): string {
  return p.split('/').pop() ?? p;
}
