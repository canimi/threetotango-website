import { builtCss } from './built-css';
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { isNew, playerData } from '../src/lib/player';
import { parseStart } from '../src/lib/quiz-score';
import { questions } from '../src/data/quiz';
import type { Episode } from '../src/lib/episodes';

const html = (p: string) => readFileSync(join('dist', p), 'utf8');
function htmlFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? htmlFiles(p) : p.endsWith('.html') ? [p] : [];
  });
}
// Google Search Console verification file is plain text, not a site page.
const pages = htmlFiles('dist').filter((f) => !/[\\/]google[0-9a-f]+\.html$/.test(f));
const home = () => html('index.html');

describe('site-wide chrome', () => {
  it.each(pages)('%s has the sticky header with the primary CTA', (f) => {
    const h = readFileSync(f, 'utf8');
    expect(h).toMatch(/<header class="site-header[^"]*"[^>]*data-site-header/);
    expect(h).toContain('data-header-sentinel');
    expect(h).toContain('Put your cat in the show');
  });

  it.each(pages)('%s has the player modal with a dialog and a close button', (f) => {
    const h = readFileSync(f, 'utf8');
    expect(h).toMatch(/<dialog class="player[^"]*"[^>]*data-player-modal/);
    expect(h).toMatch(/<button[^>]*data-player-close[^>]*aria-label="Close player"/);
  });

  it('shows the mobile floating CTA everywhere except /tango-me', () => {
    for (const f of pages) {
      const h = readFileSync(f, 'utf8');
      if (f === join('dist', 'tango-me', 'index.html')) expect(h).not.toContain('data-fcta');
      else expect(h, f).toMatch(/data-fcta[^-]/);
    }
    expect(home()).toContain('data-fcta-close');
  });

  it('never uses the old CTA copy in built HTML', () => {
    for (const f of pages) expect(readFileSync(f, 'utf8'), f).not.toContain('Tango me, free');
  });
});

describe('home redesign', () => {
  it('has the episode wall behind the hero and no "Watch latest" button', () => {
    expect(home()).toContain('data-wall');
    expect(home()).not.toContain('Watch latest');
    expect(home()).toContain('Sound on');
  });

  it('puts the play button bottom-left as its own small element, not centred', () => {
    const h = home();
    expect(h).toMatch(/<a class="thumb[^"]*"[^>]*data-player="(youtube|mp4|instagram)"/);
    expect(h).toMatch(/<span class="play[^"]*" aria-hidden="true"[^>]*>/);
    const css = builtCss();
    const rule = css.match(/\.play\[data-astro-cid-[^\]]+\]\{[^}]*\}/g)?.find((r) => r.includes('36px'));
    expect(rule).toBeTruthy();
    expect(rule).toMatch(/inset-inline-start:\.65rem/);
    expect(rule).toMatch(/inset-block-end:\.65rem/);
    expect(rule).not.toMatch(/margin:auto/);
  });

  it('opens episodes in the modal: cards carry player data and link to the detail page', () => {
    expect(home()).toContain('data-player="youtube"');
    expect(home()).toContain('data-src="https://www.youtube-nocookie.com/embed/abc123XYZ_1');
    expect(home()).toContain('href="/episodes/the-lettuce-incident"');
  });

  it('renders the episodes as a scroll rail with arrows', () => {
    expect(home()).toContain('is-rail');
    expect(home()).toContain('data-scroll="1"');
  });

  it('explains Tango Me with three numbered steps', () => {
    const h = home();
    expect(h).toContain('Tango Me: put your cat in the show');
    expect(h).toContain('Upload your cat');
    expect(h).toContain('Pick a scene and a personality');
    expect(h).toContain('Get your episode still');
  });

  it('cast picker follows the ARIA tabs pattern with Luka selected', () => {
    const h = home();
    expect(h).toMatch(/role="tablist"[^>]*aria-label="Choose a member of the household"/);
    const tabs = h.match(/<button[^>]*role="tab"[^>]*>/g) ?? [];
    expect(tabs).toHaveLength(4);
    for (const tab of tabs) {
      expect(tab).toMatch(/aria-controls="cast-panel-\w+"/);
      expect(tab).toMatch(/aria-selected="(true|false)"/);
    }
    expect(tabs.filter((x) => x.includes('aria-selected="true"'))).toHaveLength(1);
    expect(h).toMatch(/id="cast-tab-luka"[^>]*aria-selected="true"/);
    const panels = h.match(/<div[^>]*role="tabpanel"[^>]*>/g) ?? [];
    expect(panels).toHaveLength(4);
    expect(panels.filter((p) => !/\shidden/.test(p))).toHaveLength(1);
  });

  it('inline quiz renders question 1 with answers linking to /quiz?start=', () => {
    const h = home();
    expect(h).toContain(questions[0].text);
    questions[0].answers.forEach((_, i) => expect(h).toContain(`href="/quiz?start=${i}"`));
    expect(h).toContain('Seven questions and about a minute');
  });

  it('section order: hero, episodes, tango me, household, quiz, newsletter', () => {
    const h = home();
    const order = ['data-hero', 'id="episodes"', 'id="tango-me"', 'id="household"', 'id="quiz"', 'data-source="footer"'];
    const idx = order.map((n) => h.indexOf(n));
    idx.forEach((i) => expect(i).toBeGreaterThan(-1));
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
  });
});

describe('tango-me page', () => {
  it('explains the three steps before the form', () => {
    const h = html('tango-me/index.html');
    expect(h.indexOf('Upload your cat')).toBeGreaterThan(-1);
    expect(h.indexOf('Upload your cat')).toBeLessThan(h.indexOf('data-tango'));
  });
});

describe('player and quiz helpers', () => {
  const ep = (o: Partial<Episode>): Episode => ({
    id: 'x',
    platform: 'youtube',
    externalId: 'abc',
    slug: 's',
    title: 'T',
    description: '',
    publishedAt: '2026-11-01T00:00:00Z',
    thumbnailUrl: '/media/thumbs/x.jpg',
    videoUrl: 'https://www.youtube.com/watch?v=abc',
    heroMp4Path: null,
    characters: ['luka'],
    ...o,
  });
  it('youtube episodes play in a nocookie iframe', () => {
    const d = playerData(ep({}), ['luka']);
    expect(d['data-player']).toBe('youtube');
    expect(d['data-src']).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/abc\?autoplay=1/);
    expect(d['data-cast']).toBe('luka');
  });
  it('instagram episodes play the local hero mp4 when there is one', () => {
    const d = playerData(ep({ platform: 'instagram', heroMp4Path: '/data/hero/a.mp4', videoUrl: 'https://www.instagram.com/reel/x/' }), []);
    expect(d['data-player']).toBe('mp4');
    expect(d['data-src']).toBe('/media/hero/a.mp4');
  });
  it('instagram episodes without mp4 link out', () => {
    const d = playerData(ep({ platform: 'instagram', videoUrl: 'https://www.instagram.com/reel/x/' }), []);
    expect(d['data-player']).toBe('instagram');
    expect(d['data-src']).toBe('https://www.instagram.com/reel/x/');
  });
  it('isNew is true for under 7 days only', () => {
    const now = Date.parse('2026-11-07T00:00:00Z');
    expect(isNew('2026-11-01T00:00:01Z', now)).toBe(true);
    expect(isNew('2026-10-31T00:00:00Z', now)).toBe(false);
    expect(isNew('2026-11-08T00:00:00Z', now)).toBe(false);
    expect(isNew('garbage', now)).toBe(false);
  });
  it('parseStart accepts only valid first answers', () => {
    expect(parseStart('?start=0')).toBe(0);
    expect(parseStart('?start=2')).toBe(2);
    expect(parseStart('?start=3')).toBeNull();
    expect(parseStart('?start=-1')).toBeNull();
    expect(parseStart('?start=x')).toBeNull();
    expect(parseStart('')).toBeNull();
  });
});
