import { describe, it, expect, vi } from 'vitest';
import { fetchGallery, likeItem, deviceId, likedStore, formatWeek } from '../src/lib/gallery';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const memStore = (): Storage => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  } as unknown as Storage;
};
const brokenStore = (): Storage =>
  new Proxy({}, { get: () => { throw new Error('blocked'); } }) as unknown as Storage;

describe('fetchGallery', () => {
  it('builds the query and returns the page', async () => {
    const page = { featured: null, items: [{ id: 'a', name: 'Mo', img: '/media/x.jpg', likes: 1 }], next: null };
    const f = vi.fn().mockResolvedValue(json(200, page));
    const r = await fetchGallery({ sort: 'top', offset: 24, limit: 24 }, f as unknown as typeof fetch);
    expect(f.mock.calls[0][0]).toBe('/api/gallery?sort=top&offset=24&limit=24');
    expect(r).toEqual(page);
  });
  it('returns null on 500, network error and malformed JSON', async () => {
    expect(await fetchGallery({ sort: 'new', offset: 0 }, (async () => json(500, {})) as typeof fetch)).toBeNull();
    expect(await fetchGallery({ sort: 'new', offset: 0 }, (async () => { throw new Error('x'); }) as typeof fetch)).toBeNull();
    expect(await fetchGallery({ sort: 'new', offset: 0 }, (async () => new Response('nope', { status: 200 })) as typeof fetch)).toBeNull();
    expect(await fetchGallery({ sort: 'new', offset: 0 }, (async () => json(200, { items: 'x' })) as typeof fetch)).toBeNull();
  });
});

describe('likeItem', () => {
  const call = (res: () => Promise<Response>) => likeItem('a', 'd'.repeat(20), res as unknown as typeof fetch);
  it('returns likes on 200', async () => {
    expect(await call(async () => json(200, { ok: true, likes: 5, already: false }))).toEqual({ ok: true, likes: 5, already: false });
  });
  it('maps 429 to limit', async () => {
    expect(await call(async () => json(429, { ok: false, error: 'limit' }))).toEqual({ ok: false, error: 'limit' });
    expect(await call(async () => json(429, {}))).toEqual({ ok: false, error: 'limit' });
  });
  it('maps invalid body error', async () => {
    expect(await call(async () => json(400, { ok: false, error: 'invalid' }))).toEqual({ ok: false, error: 'invalid' });
  });
  it('maps network error to server', async () => {
    expect(await call(async () => { throw new Error('x'); })).toEqual({ ok: false, error: 'server' });
  });
});

describe('deviceId', () => {
  it('is stable with a store and valid', () => {
    const s = memStore();
    const a = deviceId(s);
    expect(a).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    expect(deviceId(s)).toBe(a);
  });
  it('still returns a valid id with blocked storage', () => {
    expect(deviceId(brokenStore())).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    expect(deviceId(null)).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
  });
});

describe('likedStore', () => {
  it('remembers ids', () => {
    const s = memStore();
    likedStore(s).add('a');
    expect(likedStore(s).has('a')).toBe(true);
    expect(likedStore(s).has('b')).toBe(false);
  });
  it('survives a throwing store and keeps ids for the page view', () => {
    const l = likedStore(brokenStore());
    expect(l.has('a')).toBe(false);
    expect(() => l.add('a')).not.toThrow();
    expect(l.has('a')).toBe(true);
  });
});

describe('formatWeek', () => {
  it('formats', () => {
    expect(formatWeek('2026-11-16')).toBe('Week of 16 Nov');
    expect(formatWeek('2026-01-05')).toBe('Week of 5 Jan');
  });
});
