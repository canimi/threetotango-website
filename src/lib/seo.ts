import type { Episode } from './episodes';
import { characters } from '../data/characters';
import { social } from '../data/social';

export const SITE = 'https://threetotango.canimi.app';
const BRAND = 'Three To Tango';
const SERIES_ID = `${SITE}/#series`;
const ORG_ID = `${SITE}/#organization`;
const SITE_ID = `${SITE}/#website`;
const ORG_REF = { '@type': 'Organization', '@id': ORG_ID, name: BRAND, url: `${SITE}/` };
const SERIES_REF = { '@type': 'CreativeWorkSeries', '@id': SERIES_ID, name: BRAND, url: `${SITE}/` };

/** JSON for a <script type="application/ld+json"> block; `<` is escaped so the text can never close the tag. */
export function jsonLdScript(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function abs(path: string): string {
  return new URL(path, SITE).href;
}

const EMOJI = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{20E3}]/gu;
/** Lines that only make sense on Instagram (calls to comment, questions to viewers, series boilerplate). */
const SOCIAL_LINE = /\?|\b(comment|comments|share|follow|like|tag a friend|link in bio)\b|👇|^three to tango:|new episodes every/i;

/** Caption text without emoji, Instagram calls to action and series boilerplate. */
export function cleanCaption(text: string): string {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(EMOJI, '').replace(/#[\p{L}\p{N}_]+/gu, '').replace(/\s+/g, ' ').trim())
    .filter((l) => l && !SOCIAL_LINE.test(l))
    .join(' ')
    .replace(/\s+([.,!])/g, '$1')
    .trim();
}

/** Cut at a word boundary to at most `max` characters, ending with an ellipsis when cut. */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > max * 0.4 ? cut.slice(0, sp) : cut).replace(/[\s,;:.-]+$/, '')}…`;
}

/** Meta description for an episode page: the clean web description from the import, else a cleaned caption. */
export function episodeDescription(e: Episode): string {
  if (e.seoDescription) return e.seoDescription;
  const cleaned = cleanCaption(e.description || '');
  if (cleaned.length >= 60) return clip(cleaned, 158);
  const lead = cleaned ? `${cleaned} ` : '';
  return clip(`${lead}${e.title}: an episode of ${BRAND}, a wordless 3D-animated cat comedy about Nora and her three cats.`, 158);
}

/** Short premise shown on the episode page (never the raw Instagram caption). */
export function episodeSummary(e: Episode): string {
  return e.summary || cleanCaption(e.description || '');
}

/** "<Episode> – Animated Cat Comedy | Three To Tango" when it fits in ~60 characters. */
export function episodeTitle(title: string): string {
  const long = `${title} – Animated Cat Comedy | ${BRAND}`;
  return long.length <= 62 ? long : `${title} | ${BRAND}`;
}

export function organizationLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORG_ID,
    name: BRAND,
    url: `${SITE}/`,
    sameAs: [social.instagram, social.youtube],
  };
}

export function websiteLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': SITE_ID,
    name: BRAND,
    url: `${SITE}/`,
    inLanguage: 'en',
    publisher: ORG_REF,
  };
}

export function seriesLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'CreativeWorkSeries',
    '@id': SERIES_ID,
    name: BRAND,
    url: `${SITE}/`,
    description:
      'A wordless 3D-animated cat comedy about Nora and her three cats, Luka, Budy and Caddy. New episodes every Monday, Wednesday, Friday and Sunday.',
    genre: ['Comedy', 'Animation'],
    inLanguage: 'zxx',
    publisher: ORG_REF,
    character: (['luka', 'budy', 'caddy', 'nora'] as const).map((id) => ({
      '@type': 'Person',
      name: `${characters[id].name}, ${characters[id].nickname}`,
      url: abs(`/cats/${id}`),
    })),
    sameAs: [social.instagram, social.youtube],
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: abs(it.path),
    })),
  };
}

/**
 * VideoObject for an episode — only when the video really plays on the page
 * (YouTube embed or a self-hosted MP4). Instagram-only episodes return null.
 */
export function videoLd(e: Episode): Record<string, unknown> | null {
  const mp4 = e.heroMp4Path ? `/media/hero/${e.heroMp4Path.split('/').pop()}` : '';
  const isYt = e.platform === 'youtube';
  if (!isYt && !mp4) return null;
  if (!e.thumbnailUrl || Number.isNaN(Date.parse(e.publishedAt))) return null;
  const cast = e.characters.filter((c) => Object.hasOwn(characters, c));
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: e.title,
    description: episodeDescription(e),
    thumbnailUrl: [abs(e.thumbnailUrl)],
    uploadDate: e.publishedAt,
    ...(isYt
      ? { embedUrl: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(e.externalId)}` }
      : { contentUrl: abs(mp4) }),
    url: abs(`/episodes/${e.slug}`),
    genre: 'Comedy',
    isFamilyFriendly: true,
    partOfSeries: SERIES_REF,
    publisher: ORG_REF,
    ...(cast.length ? { character: cast.map((c) => ({ '@type': 'Person', name: characters[c].name })) } : {}),
  };
}
