import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lightFor } from '../src/scripts/house-light';
import { walkSprites } from '../src/lib/cast-assets';

const page = (p: string) => readFileSync(join('dist', p), 'utf8');

describe('house look (TTW_09): materials, living portraits, signatures', () => {
  it('maps the visitor clock to the five light states of the world bible', () => {
    expect([4, 5, 6, 7, 11, 12, 16, 17, 20, 21, 23].map(lightFor)).toEqual([
      'night', 'dawn', 'dawn', 'morning', 'morning', 'afternoon', 'afternoon', 'evening', 'evening', 'night', 'night',
    ]);
  });

  it('self-hosts Fraunces and preloads the hero weight', () => {
    for (const f of ['600-normal', '600-italic', '400-italic']) expect(existsSync(`public/fonts/fraunces-latin-${f}.woff2`)).toBe(true);
    expect(page('index.html')).toContain('rel="preload" href="/fonts/fraunces-latin-600-normal.woff2"');
  });

  it('ships the full-stride WAN 3.0 walk cycles for Luka and Budy only (Caddy does not walk), plus the living-portrait loops', () => {
    const sprites = walkSprites();
    expect(sprites.map((s) => s.id).sort()).toEqual(['budy', 'luka']);
    expect(Object.fromEntries(sprites.map((s) => [s.id, s.frames]))).toEqual({ luka: 29, budy: 30 });
    for (const s of sprites) {
      // content-hash cache buster: a regenerated sheet must never meet a cached old one
      expect(s.src).toMatch(/^\/img\/cast\/walk-(luka|budy)\.webp\?v=[0-9a-f]{8}$/);
      expect(s.src2x).toMatch(/@2x\.webp\?v=[0-9a-f]{8}$/);
    }
    for (const id of ['luka', 'budy', 'caddy']) {
      expect(existsSync(`public/img/house/portrait-${id}.mp4`)).toBe(true);
      expect(existsSync(`public/img/house/portrait-${id}.webp`)).toBe(true);
    }
  });

  it('living portraits never preload video and only attach the source by script', () => {
    const h = page('cats/luka/index.html');
    expect(h).toMatch(/<video[^>]*preload="none"[^>]*poster="\/img\/house\/portrait-luka\.webp"/);
    expect(h).toContain('data-src="/img/house/portrait-luka.mp4"');
    expect(h).not.toMatch(/<source src="\/img\/house\/portrait-luka\.mp4"/);
  });

  it('gives every character page its own finish', () => {
    expect(page('cats/luka/index.html')).toContain('Luka has opened an investigation.');
    expect(page('cats/budy/index.html')).toContain('Budy is typing (he never stops)');
    expect(page('cats/caddy/index.html')).toContain('data-caddy-still');
    expect(page('cats/nora/index.html')).toContain('/img/house/nora-desk-1600.webp');
  });

  it('opens episode pages and the 404 with a silent-film intertitle', () => {
    expect(page('404.html')).toContain('class="intertitle"');
    expect(page('404.html')).toContain('/img/house/luka-404-1600.webp');
    expect(page('404.html')).toMatch(/<h1 class="line"[^>]*>404\. Luka pushed this page off the table\.<\/h1>/);
  });

  it('puts the tango steps on the home page and the floor under every footer', () => {
    expect(page('index.html')).toContain('How to tango (with three cats)');
    expect(page('gallery/index.html')).toContain('/img/house/footer-floor-1200.webp');
  });
});

describe('owner fixes 2026-11-25 (hero, cats page, profile buttons, filters)', () => {
  it('home has no gallery section and no visible slogan', () => {
    const h = page('index.html');
    expect(h).not.toContain('New in the gallery');
    expect(h).not.toContain('class="slogan"');
  });

  it('/cats shows every member with a living portrait and big Meet / Chat buttons', () => {
    const h = page('cats/index.html');
    for (const id of ['luka', 'budy', 'caddy']) {
      expect(h).toContain(`data-src="/img/house/portrait-${id}.mp4"`);
      expect(h).toContain(`href="/chat?cat=${id}"`);
    }
    for (const n of ['Luka', 'Budy', 'Caddy', 'Nora']) expect(h).toMatch(new RegExp(`class="btn btn-lg"[^>]*>Meet ${n}<`));
    expect(h).not.toContain('Full profile');
  });

  it('the household panel on home links each cat with a real button', () => {
    const h = page('index.html');
    expect(h).toMatch(/class="btn btn-lg"[^>]*>Meet Luka</);
    expect(h).not.toContain('Full profile');
  });
});

describe('hero text (owner decision: never visible)', () => {
  it('keeps the h1 sr-only and hides the pitch line visually until a visitor adds their cat', () => {
    const h = page('index.html');
    expect(h).toMatch(/<h1 class="sr-only"/);
    expect(h).toMatch(/\.pitch\[[^\]]*\]:not\(\.is-personal\) \.line\[[^\]]*\]\{[^}]*clip-path:inset\(50%\)/);
  });
});

describe('household panel fills wide screens', () => {
  it('puts portrait and details side by side from 60rem', () => {
    expect(page('index.html')).toMatch(/@media\(min-width:60rem\)\{\.panel\[[^\]]*\]\{grid-template-columns:minmax\(18rem,30rem\) minmax\(0,1fr\)/);
  });
});
