import type { Episode } from './episodes';

export type PlayerKind = 'youtube' | 'mp4' | 'instagram';

export interface PlayerData {
  'data-player': PlayerKind;
  'data-src': string;
  'data-title': string;
  'data-cast': string;
  'data-poster': string;
  'data-href': string;
  'data-external': string;
}

/** Data attributes that let the shared player modal play an episode. */
export function playerData(e: Episode, cast: string[]): PlayerData {
  const hero = e.heroMp4Path ? `/media/hero/${basename(e.heroMp4Path)}` : '';
  let kind: PlayerKind;
  let src: string;
  if (e.platform === 'youtube') {
    kind = 'youtube';
    src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(e.externalId)}?autoplay=1&rel=0&playsinline=1`;
  } else if (hero) {
    kind = 'mp4';
    src = hero;
  } else {
    kind = 'instagram';
    src = e.videoUrl;
  }
  return {
    'data-player': kind,
    'data-src': src,
    'data-title': e.title,
    'data-cast': cast.join(' '),
    'data-poster': e.thumbnailUrl,
    'data-href': `/episodes/${e.slug}`,
    'data-external': e.videoUrl,
  };
}

function basename(p: string): string {
  return p.split('/').pop() ?? p;
}

const WEEK = 7 * 24 * 60 * 60 * 1000;

/** True if the episode was published less than 7 days before `now`. */
export function isNew(publishedAt: string, now: number = Date.now()): boolean {
  const t = Date.parse(publishedAt);
  return Number.isFinite(t) && now - t >= 0 && now - t < WEEK;
}
