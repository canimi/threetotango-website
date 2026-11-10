import { t } from '../i18n/t';
import { track } from './track';

export interface GalleryItem {
  id: string;
  name: string;
  img: string;
  likes: number;
}
export interface GalleryPage {
  featured: (GalleryItem & { weekStart: string }) | null;
  items: GalleryItem[];
  next: number | null;
}
export type LikeResult = { ok: true; likes: number; already: boolean } | { ok: false; error: 'limit' | 'invalid' | 'server' };

const DEVICE_KEY = 'ttw.device';
const LIKED_KEY = 'ttw.liked';
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

async function readBody(res: Response): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = await res.json();
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function asItem(v: unknown): GalleryItem | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== 'string' || !ID_RE.test(o.id)) return null;
  if (typeof o.name !== 'string' || typeof o.img !== 'string' || !o.img.startsWith('/')) return null;
  const likes = typeof o.likes === 'number' && Number.isFinite(o.likes) ? Math.max(0, Math.floor(o.likes)) : 0;
  return { id: o.id, name: o.name, img: o.img, likes };
}

/** Never throws: any network, status or shape problem yields null. */
export async function fetchGallery(
  opts: { sort: 'new' | 'top'; offset: number; limit?: number },
  fetchFn: typeof fetch = fetch,
): Promise<GalleryPage | null> {
  try {
    const q = `sort=${opts.sort}&offset=${opts.offset}&limit=${opts.limit ?? 24}`;
    const res = await fetchFn(`/api/gallery?${q}`);
    if (!res.ok) return null;
    const body = await readBody(res);
    if (!body || !Array.isArray(body.items)) return null;
    const items = body.items.map(asItem).filter((i): i is GalleryItem => i !== null);
    let featured: GalleryPage['featured'] = null;
    const f = asItem(body.featured);
    const week = (body.featured as Record<string, unknown> | null)?.weekStart;
    if (f && typeof week === 'string') featured = { ...f, weekStart: week };
    const next = typeof body.next === 'number' ? body.next : null;
    return { featured, items, next };
  } catch {
    return null;
  }
}

export async function likeItem(id: string, device: string, fetchFn: typeof fetch = fetch): Promise<LikeResult> {
  let status = 0;
  let body: Record<string, unknown> | null = null;
  try {
    const res = await fetchFn('/api/gallery/like', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, device }),
    });
    status = res.status;
    body = await readBody(res);
  } catch {
    return { ok: false, error: 'server' };
  }
  if (status === 200 && body?.ok === true && typeof body.likes === 'number') {
    return { ok: true, likes: body.likes, already: body.already === true };
  }
  if (status === 429 || body?.error === 'limit') return { ok: false, error: 'limit' };
  if (body?.error === 'invalid' || status === 400) return { ok: false, error: 'invalid' };
  return { ok: false, error: 'server' };
}

function randomId(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  const bytes = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  let out = '';
  for (const b of bytes) out += alphabet[b % 64];
  return out;
}

function defaultStore(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

let pageViewDevice: string | null = null;

/** Persistent random id (localStorage `ttw.device`); a per-page-view id when storage is unavailable. */
export function deviceId(store: Storage | null = defaultStore()): string {
  try {
    const saved = store?.getItem(DEVICE_KEY);
    if (saved && /^[A-Za-z0-9_-]{16,64}$/.test(saved)) return saved;
    const fresh = randomId();
    store?.setItem(DEVICE_KEY, fresh);
    return fresh;
  } catch {
    pageViewDevice ??= randomId();
    return pageViewDevice;
  }
}

/** Liked ids in localStorage `ttw.liked`; with no usable storage they live for this page view only. */
export function likedStore(store: Storage | null = defaultStore()): { has(id: string): boolean; add(id: string): void } {
  const mem = new Set<string>();
  try {
    const raw = store?.getItem(LIKED_KEY);
    const arr: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(arr)) for (const v of arr) if (typeof v === 'string') mem.add(v);
  } catch {
    /* start empty */
  }
  return {
    has: (id) => mem.has(id),
    add(id) {
      mem.add(id);
      try {
        store?.setItem(LIKED_KEY, JSON.stringify([...mem].slice(-500)));
      } catch {
        /* page-view only */
      }
    },
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function formatWeek(weekStart: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(weekStart);
  if (!m) return '';
  return `Week of ${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? ''}`.trim();
}

const NOTE_KEYS: Record<'limit' | 'invalid' | 'server', string> = {
  limit: 'gallery.likeLimit',
  invalid: 'gallery.likeGone',
  server: 'gallery.likeError',
};

/** Card markup. The cat name only ever reaches the DOM through textContent / setAttribute. */
export function renderCard(item: GalleryItem, liked: boolean): HTMLElement {
  const li = document.createElement('li');
  li.className = 'gcard';
  li.dataset.id = item.id;
  const tilt = ((item.id.charCodeAt(0) + item.id.length) % 7) - 3;
  li.style.setProperty('--tilt', `${(tilt * 0.7).toFixed(1)}deg`);

  const a = document.createElement('a');
  a.className = 'polaroid';
  a.href = `/tango-me/r/${encodeURIComponent(item.id)}`;
  const tape = document.createElement('span');
  tape.className = 'tape';
  tape.setAttribute('aria-hidden', 'true');
  const img = document.createElement('img');
  img.src = item.img;
  img.width = 800;
  img.height = 1000;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.alt = t('gallery.imgAlt').replace('{name}', item.name);
  const cap = document.createElement('span');
  cap.className = 'cap';
  cap.textContent = item.name;
  a.append(tape, img, cap);

  const row = document.createElement('div');
  row.className = 'likes';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'heart';
  btn.setAttribute('aria-pressed', String(liked));
  btn.setAttribute('aria-label', t('gallery.likeLabel').replace('{name}', item.name));
  btn.innerHTML =
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.7 4.8 6.2 4.8c2.1 0 3.8 1.2 5.8 3.6 2-2.4 3.7-3.6 5.8-3.6 3.5 0 5.3 3.6 3.8 7C19.5 16.4 12 21 12 21Z"/></svg>';
  const count = document.createElement('span');
  count.className = 'count';
  count.textContent = String(item.likes);
  const note = document.createElement('span');
  note.className = 'note';
  note.setAttribute('role', 'status');
  row.append(btn, count, note);

  li.append(a, row);
  return li;
}

/** Settle a card after the server answered. `prevLikes` is the count before the optimistic +1. */
export function applyLike(card: HTMLElement, result: LikeResult, prevLikes: number): void {
  const btn = card.querySelector('button.heart');
  const count = card.querySelector('.count');
  const note = card.querySelector('.note');
  if (!btn || !count) return;
  if (result.ok) {
    btn.setAttribute('aria-pressed', 'true');
    count.textContent = String(result.likes);
    if (note) note.textContent = '';
    return;
  }
  btn.setAttribute('aria-pressed', 'false');
  count.textContent = String(prevLikes);
  if (note) note.textContent = t(NOTE_KEYS[result.error]);
}

/** Show or clear the "gallery is napping" message in a role="status" element (used when Show more fails). */
export function setLoadError(el: HTMLElement, on: boolean): void {
  el.textContent = on ? t('gallery.error') : '';
}

/** renderCard plus the optimistic heart behaviour; shared by the gallery page and the home section. */
export function buildCard(
  item: GalleryItem,
  liked: { has(id: string): boolean; add(id: string): void },
  device: string,
): HTMLElement {
  const card = renderCard(item, liked.has(item.id));
  const btn = card.querySelector<HTMLButtonElement>('button.heart')!;
  btn.addEventListener('click', async () => {
    if (btn.getAttribute('aria-pressed') === 'true' || btn.disabled) return;
    const count = card.querySelector<HTMLElement>('.count')!;
    const prev = Number(count.textContent) || 0;
    btn.setAttribute('aria-pressed', 'true');
    count.textContent = String(prev + 1);
    btn.disabled = true;
    const result = await likeItem(item.id, device);
    btn.disabled = false;
    applyLike(card, result, prev);
    if (result.ok) {
      liked.add(item.id);
      if (!result.already) track('gallery-like');
    }
  });
  return card;
}

/**
 * What the result screen does with a failed opt-in. On the result screen the generation is done and
 * the token matches, so 'invalid' means the cat is no longer in state "none": it is already queued
 * (e.g. the box was ticked before a page reload), so show the waiting note, not a retry error.
 */
export function optinFailureAction(error: string): 'waiting' | 'bad_token' | 'retry' {
  if (error === 'invalid') return 'waiting';
  if (error === 'bad_token') return 'bad_token';
  return 'retry';
}
