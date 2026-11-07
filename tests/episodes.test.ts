import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchEpisodes,
  filterByCharacter,
  latestWithHero,
  type Episode,
} from '../src/lib/episodes';

const ep = (over: Partial<Episode> = {}): Episode => ({
  id: 'e1',
  platform: 'youtube',
  externalId: 'x1',
  slug: 'ep-1',
  title: 'Ep 1',
  description: 'desc',
  publishedAt: '2026-01-01T00:00:00Z',
  thumbnailUrl: 'https://img/1.jpg',
  videoUrl: 'https://v/1',
  heroMp4Path: null,
  characters: ['nora'],
  ...over,
});

const okResponse = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

describe('fetchEpisodes', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('returns [] when url is undefined', async () => {
    const fn = vi.fn();
    expect(await fetchEpisodes(undefined, fn as unknown as typeof fetch)).toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });

  it('returns [] on non-200', async () => {
    const fn = vi.fn(async () => ({ ok: false, status: 500 }) as Response);
    expect(await fetchEpisodes('http://x', fn as unknown as typeof fetch)).toEqual([]);
  });

  it('returns [] on network error', async () => {
    const fn = vi.fn(async () => {
      throw new Error('boom');
    });
    expect(await fetchEpisodes('http://x', fn as unknown as typeof fetch)).toEqual([]);
  });

  it('returns [] when body is not an array', async () => {
    const fn = vi.fn(async () => okResponse({ nope: true }));
    expect(await fetchEpisodes('http://x', fn as unknown as typeof fetch)).toEqual([]);
  });

  it('returns [] when json parsing throws', async () => {
    const fn = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('bad json');
      },
    }) as unknown as Response);
    expect(await fetchEpisodes('http://x', fn as unknown as typeof fetch)).toEqual([]);
  });

  it('sorts newest first', async () => {
    const list = [
      ep({ id: 'old', publishedAt: '2026-01-01T00:00:00Z' }),
      ep({ id: 'new', publishedAt: '2026-03-01T00:00:00Z' }),
      ep({ id: 'mid', publishedAt: '2026-02-01T00:00:00Z' }),
    ];
    const fn = vi.fn(async () => okResponse(list));
    const res = await fetchEpisodes('http://x', fn as unknown as typeof fetch);
    expect(res.map((e) => e.id)).toEqual(['new', 'mid', 'old']);
  });
});

describe('filterByCharacter', () => {
  const list = [
    ep({ id: 'a', characters: ['budy', 'nora'] }),
    ep({ id: 'b', characters: ['luka'] }),
  ];
  it('keeps only episodes including the character', () => {
    expect(filterByCharacter(list, 'budy').map((e) => e.id)).toEqual(['a']);
  });
  it("'all' returns all", () => {
    expect(filterByCharacter(list, 'all')).toHaveLength(2);
  });
});

describe('latestWithHero', () => {
  it('skips episodes with null heroMp4Path', () => {
    const list = [
      ep({ id: 'new', heroMp4Path: null }),
      ep({ id: 'hero', heroMp4Path: '/hero.mp4' }),
    ];
    expect(latestWithHero(list)?.id).toBe('hero');
  });
  it('returns null when none have hero', () => {
    expect(latestWithHero([ep()])).toBeNull();
  });
});
