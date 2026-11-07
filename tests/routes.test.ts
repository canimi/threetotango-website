import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import fixture from './fixtures/episodes.json';

const dist = (p: string) => join('dist', p);
const html = (p: string) => readFileSync(dist(p), 'utf8');

describe('built routes', () => {
  const pages = [
    'index.html',
    'cats/index.html',
    'cats/luka/index.html',
    'cats/budy/index.html',
    'cats/caddy/index.html',
    'cats/nora/index.html',
    'episodes/index.html',
    'behind-the-scenes/index.html',
    'links/index.html',
    'privacy/index.html',
    'contact/index.html',
    '404.html',
    ...fixture.map((e) => `episodes/${e.slug}/index.html`),
  ];
  it.each(pages)('%s exists', (p) => {
    expect(existsSync(dist(p))).toBe(true);
  });

  describe('home', () => {
    const page = () => html('index.html');
    it('has brand promise and 4+ tango-me links', () => {
      expect(page()).toContain('Nora lives her best life. Her three cats have other plans.');
      expect((page().match(/href="\/tango-me"/g) ?? []).length).toBeGreaterThanOrEqual(4);
    });
    it('plays the hero mp4 of the latest hero episode', () => {
      expect(page()).toContain('/media/hero/the-lettuce-incident.mp4');
    });
    it('shows four household cards and filter chips', () => {
      for (const id of ['luka', 'budy', 'caddy', 'nora']) expect(page()).toContain(`/cats/${id}`);
      expect(page()).toContain('data-characters="nora budy"');
    });
    it('does not embed an iframe before tap', () => {
      expect(page()).not.toContain('<iframe');
    });
    it('links quiz, gift and behind the scenes', () => {
      for (const h of ['/quiz', '/gift', '/behind-the-scenes'])
        expect(page()).toContain(`href="${h}"`);
    });
  });

  it('episode page links prev/next and characters', () => {
    const mid = html('episodes/keyboard-landlord/index.html');
    expect(mid).toContain('/episodes/the-lettuce-incident');
    expect(mid).toContain('/episodes/the-rug-is-mine');
    expect(mid).toContain('/cats/luka');
    expect(mid).toContain('href="/tango-me"');
  });

  it('links page has the big buttons', () => {
    const p = html('links/index.html');
    for (const h of ['/tango-me', '/quiz', '/gift', 'youtube.com', 'instagram.com'])
      expect(p).toContain(h);
  });

  it('behind-the-scenes discloses AI', () => {
    expect(html('behind-the-scenes/index.html')).toMatch(/AI/);
  });
});
