/**
 * Umami custom events. Safe to call anywhere: does nothing when the Umami script
 * is missing (no PUBLIC_UMAMI_ID, blocked by an ad blocker, not loaded yet) or throws.
 */
export type TrackData = Record<string, string | number | boolean>;

interface UmamiLike {
  track: (name: string, data?: TrackData) => unknown;
}

export function track(name: string, data?: TrackData, w: unknown = globalThis): void {
  try {
    const u = (w as { umami?: UmamiLike }).umami;
    if (u && typeof u.track === 'function') {
      if (data) u.track(name, data);
      else u.track(name);
    }
  } catch {
    /* analytics must never break the page */
  }
}

export interface LinkEvent {
  name: 'social-click' | 'tango-cta';
  data: TrackData;
}

/**
 * Decide whether a clicked link is worth an event.
 * - Instagram / YouTube links -> social-click {to}
 * - Links into /tango-me from another page -> tango-cta {scene?, personality?}
 */
export function classifyLink(href: string, pagePath: string, origin: string): LinkEvent | null {
  let u: URL;
  try {
    u = new URL(href, origin);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, '');
  if (host === 'instagram.com') return { name: 'social-click', data: { to: 'instagram' } };
  if (host === 'youtube.com' || host === 'youtu.be') return { name: 'social-click', data: { to: 'youtube' } };
  if (u.origin === new URL(origin).origin && /^\/tango-me\/?$/.test(u.pathname) && !/^\/tango-me(\/|$)/.test(pagePath)) {
    const data: TrackData = {};
    const scene = u.searchParams.get('scene');
    const personality = u.searchParams.get('personality');
    if (scene) data.scene = scene.slice(0, 40);
    if (personality) data.personality = personality.slice(0, 40);
    return { name: 'tango-cta', data };
  }
  return null;
}
