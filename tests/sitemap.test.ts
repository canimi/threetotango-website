import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

describe('sitemap and robots', () => {
  it('ships robots.txt pointing at the sitemap and keeping /api out', () => {
    const r = readFileSync('public/robots.txt', 'utf8');
    expect(r).toMatch(/^Sitemap: https:\/\/threetotango\.canimi\.app\/sitemap\.xml$/m);
    expect(r).toMatch(/^Disallow: \/api\/$/m);
  });
  it('lists the main pages and every character page, not /links', () => {
    if (!existsSync('dist/sitemap.xml')) return; // only after a build
    const s = readFileSync('dist/sitemap.xml', 'utf8');
    for (const p of ['/', '/tango-me/', '/cats/luka/', '/cats/nora/', '/episodes/', '/quiz/budy/', '/gift/']) {
      expect(s).toContain(`<loc>https://threetotango.canimi.app${p}</loc>`);
    }
    expect(s).not.toContain('/links/');
  });
});
