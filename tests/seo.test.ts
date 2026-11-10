import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import type { Episode } from '../src/lib/episodes';
import { cleanCaption, clip, episodeDescription, episodeSummary, episodeTitle, jsonLdScript, videoLd } from '../src/lib/seo';

const base: Episode = {
  id: 'x',
  platform: 'instagram',
  externalId: '123',
  slug: 'poor-little-caddy-123',
  title: 'Poor Little Caddy',
  description: 'Have ever stepped on your cat?\nComment below! 🐱❤️👇',
  publishedAt: '2026-11-07T16:11:15Z',
  thumbnailUrl: '/media/thumbs/123.jpg',
  videoUrl: 'https://www.instagram.com/reel/abc/',
  heroMp4Path: null,
  characters: ['caddy'],
};

describe('seo helpers', () => {
  it('cleans Instagram captions (emoji, questions, calls to action, boilerplate)', () => {
    const c = cleanCaption(
      "She's 15. She fears nothing. Including this. 🤖\n\nIs your cat scared of the vacuum? 👇\n\nThree To Tango: a wordless 3D-animated comedy.\nNew episodes every Mon, Wed, Fri and Sun.",
    );
    expect(c).toBe("She's 15. She fears nothing. Including this.");
    expect(cleanCaption(base.description)).toBe('');
  });
  it('prefers the import-written web description and falls back to a clean sentence', () => {
    expect(episodeDescription({ ...base, seoDescription: 'Clean text.' })).toBe('Clean text.');
    const d = episodeDescription(base);
    expect(d).toContain('Poor Little Caddy');
    expect(d).not.toMatch(/comment|👇|\?/i);
    expect(d.length).toBeLessThanOrEqual(158);
  });
  it('never shows the raw caption as the summary', () => {
    expect(episodeSummary(base)).toBe('');
    expect(episodeSummary({ ...base, summary: 'Someone steps on Caddy.' })).toBe('Someone steps on Caddy.');
  });
  it('clips at a word boundary', () => {
    expect(clip('one two three four five', 12)).toBe('one two…');
    expect(clip('short', 12)).toBe('short');
  });
  it('adds the genre to short titles only', () => {
    expect(episodeTitle('5 AM Alarm')).toBe('5 AM Alarm – Animated Cat Comedy | Three To Tango');
    expect(episodeTitle('A Very Long Episode Title That Goes On')).toBe('A Very Long Episode Title That Goes On | Three To Tango');
  });
  it('emits VideoObject only when the video plays on the site', () => {
    expect(videoLd(base)).toBeNull();
    const v = videoLd({ ...base, heroMp4Path: '/media/hero/123.mp4' })!;
    expect(v['@type']).toBe('VideoObject');
    expect(v.contentUrl).toBe('https://threetotango.canimi.app/media/hero/123.mp4');
    const yt = videoLd({ ...base, platform: 'youtube', externalId: 'abc' })!;
    expect(yt.embedUrl).toBe('https://www.youtube-nocookie.com/embed/abc');
  });
  it('escapes < in JSON-LD', () => {
    expect(jsonLdScript({ a: '</script>' })).not.toContain('</script>');
  });
});

describe('built pages', () => {
  const read = (p: string) => readFileSync(p, 'utf8');
  it('home has WebSite, Organization and CreativeWorkSeries JSON-LD and a short title', () => {
    if (!existsSync('dist/index.html')) return;
    const h = read('dist/index.html');
    for (const type of ['"WebSite"', '"Organization"', '"CreativeWorkSeries"']) expect(h).toContain(`"@type":${type}`);
    const title = /<title>([^<]*)<\/title>/.exec(h)![1];
    expect(title.length).toBeLessThanOrEqual(60);
    expect(h).toMatch(/<meta property="og:image:width" content="1200">/);
    expect(h).toMatch(/<meta name="twitter:image" content="https:\/\/threetotango\.canimi\.app\/img\/og-default\.jpg">/);
  });
  it('canonical URLs have no trailing slash', () => {
    if (!existsSync('dist/cats/luka/index.html')) return;
    expect(read('dist/cats/luka/index.html')).toContain('<link rel="canonical" href="https://threetotango.canimi.app/cats/luka">');
    expect(read('dist/cats/luka/index.html')).toContain('"@type":"BreadcrumbList"');
  });
  it('episode page: breadcrumb, VideoObject for playable video, related episodes', () => {
    if (!existsSync('dist/episodes/the-lettuce-incident/index.html')) return;
    const h = read('dist/episodes/the-lettuce-incident/index.html');
    expect(h).toContain('"@type":"BreadcrumbList"');
    expect(h).toContain('"@type":"VideoObject"');
    expect(h).toContain('class="related"');
    const ig = read('dist/episodes/keyboard-landlord/index.html');
    expect(ig).not.toContain('"@type":"VideoObject"');
  });
  it('ships the default share image and keeps words apart in cards', () => {
    expect(existsSync('public/img/og-default.jpg')).toBe(true);
    if (!existsSync('dist/cats/index.html')) return;
    expect(read('dist/cats/index.html')).not.toMatch(/Luka<span class="nick"/);
  });
});
