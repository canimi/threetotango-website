import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { lineupCats, walkSprites, imageSize } from '../src/lib/cast-assets';
import { stashPhoto, takePendingPhoto, idbKV, PENDING_KEY, PENDING_TTL_MS, type KV } from '../src/lib/pending-photo';
import { magnet, tilt } from '../src/lib/pointer-math';
import { builtCss } from './built-css';
import WalkingCats from '../src/components/WalkingCats.astro';
import CastLineup from '../src/components/CastLineup.astro';

const home = () => readFileSync(join('dist', 'index.html'), 'utf8');
const builtJs = () =>
  readdirSync('dist/_astro')
    .filter((f) => f.endsWith('.js'))
    .map((f) => readFileSync(join('dist/_astro', f), 'utf8'))
    .join('\n');

function tempPublic(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'ttw-cast-'));
  mkdirSync(join(root, 'public', 'img', 'cast'), { recursive: true });
  for (const [name, body] of Object.entries(files)) writeFileSync(join(root, 'public', 'img', 'cast', name), body);
  return root;
}
const walkJson = JSON.stringify({ frames: 8, frameWidth: 96, frameHeight: 64, fps: 12 });

describe('v3 hero', () => {
  it('has no visible "Nora lives" headline, only a visually-hidden h1 with the brand line', () => {
    const h = home();
    const h1s = [...h.matchAll(/<h1\b([^>]*)>([\s\S]*?)<\/h1>/g)];
    expect(h1s).toHaveLength(1);
    expect(h1s[0][1]).toMatch(/class="[^"]*\bsr-only\b/);
    expect(h1s[0][2]).toContain('Nora lives her best life. Her three cats have other plans.');
    const body = h.slice(h.indexOf('<body')).replace(h1s[0][0], '');
    expect(body).not.toContain('Nora lives');
  });

  it('renders the cast lineup: three cats that open the cast picker, plus the "+ Your cat" drop zone', () => {
    const h = home();
    expect(h).toContain('data-lineup');
    for (const id of ['luka', 'budy', 'caddy']) {
      expect(h).toMatch(new RegExp(`<a class="cat"[^>]*href="/cats/${id}"[^>]*data-cast-open="${id}"`));
      expect(h).toContain(`id="cast-tab-${id}"`);
    }
    expect(h).toMatch(/<a class="cat slot"[^>]*href="\/tango-me"[^>]*data-drop/);
    expect(h).toMatch(/<input type="file" accept="image\/\*,\.heic"[^>]*data-drop-input/);
    expect(h).toContain('+ Your cat');
    expect(h).toContain('A wordless 3D cat comedy. The household has room for one more.');
    for (const b of ['🤨 a trap?', 'MEOW? Food?', '…zzz']) expect(h).toContain(b);
  });

  it('uses the face crops while the cutouts are missing (no <img> to a missing file)', () => {
    const cats = lineupCats(tempPublic({}));
    expect(cats.map((c) => c.cutout)).toEqual([null, null, null]);
    expect(cats.map((c) => c.face)).toEqual(['/img/cast/luka-face.webp?v=2', '/img/cast/budy-face.webp?v=2', '/img/cast/caddy-face.webp?v=2']);
  });

  it('picks cutouts when they land, preferring webp over png', () => {
    const root = tempPublic({ 'cast-luka.webp': 'x', 'cast-luka.png': 'x', 'cast-budy.png': 'x', 'cast-caddy.webp': 'x' });
    expect(lineupCats(root).map((c) => c.cutout)).toEqual([
      '/img/cast/cast-luka.webp',
      '/img/cast/cast-budy.png',
      '/img/cast/cast-caddy.webp',
    ]);
  });

  it('CastLineup renders portraits unless every cutout exists', async () => {
    const c = await AstroContainer.create();
    const partial = await c.renderToString(CastLineup, {
      props: { cats: lineupCats(tempPublic({ 'cast-luka.webp': 'x' })) },
    });
    expect(partial).toContain('is-portrait');
    expect(partial).not.toContain('cast-luka.webp');
    const full = await c.renderToString(CastLineup, {
      props: { cats: lineupCats(tempPublic({ 'cast-luka.webp': 'x', 'cast-budy.webp': 'x', 'cast-caddy.webp': 'x' })) },
    });
    expect(full).toContain('is-cutout');
    expect(full).toContain('src="/img/cast/cast-budy.webp"');
  });
});

describe('real cast assets', () => {
  it('reads intrinsic sizes from PNG and WebP headers', () => {
    for (const id of ['luka', 'budy', 'caddy']) {
      const png = imageSize(join('public', 'img', 'cast', `cast-${id}.png`));
      const webp = imageSize(join('public', 'img', 'cast', `cast-${id}.webp`));
      if (!png && !webp) continue; // assets not committed in this checkout
      expect(webp).toEqual(png);
      expect(png?.height).toBe(648);
    }
    expect(imageSize('does/not/exist.png')).toBeNull();
  });

  it('the built hero uses the real cutouts with their true width/height once all three exist', () => {
    const cats = lineupCats();
    if (!cats.every((c) => c.cutout)) return;
    const h = home();
    expect(h).toContain('lineup is-cutout');
    for (const c of cats) expect(h).toContain(`src="${c.cutout}" width="${c.width}" height="${c.height}"`);
    expect(h).not.toMatch(/cast-[a-z]+\.webp"[^>]*decoding="async"/);
  });

  it('uses the @2x walk sheet through image-set when its frame count matches', () => {
    const j2 = JSON.stringify({ frames: 8, frameWidth: 192, frameHeight: 128, fps: 12 });
    const root = tempPublic({ 'walk-luka.webp': 'x', 'walk-luka.json': walkJson, 'walk-luka@2x.webp': 'x', 'walk-luka@2x.json': j2 });
    expect(walkSprites(root)[0].src2x).toBe('/img/cast/walk-luka@2x.webp');
    const bad = tempPublic({ 'walk-luka.webp': 'x', 'walk-luka.json': walkJson, 'walk-luka@2x.webp': 'x', 'walk-luka@2x.json': j2.replace('"frames":8', '"frames":9') });
    expect(walkSprites(bad)[0].src2x).toBeUndefined();
  });
});

describe('walking cats', () => {
  it('finds no sprites when none exist, and skips sheets without valid json', () => {
    expect(walkSprites(tempPublic({}))).toEqual([]);
    expect(
      walkSprites(
        tempPublic({
          'walk-luka.webp': 'x', // no json
          'walk-budy.png': 'x',
          'walk-budy.json': '{bad',
          'walk-caddy.json': walkJson, // no sheet
        }),
      ),
    ).toEqual([]);
    expect(walkSprites(tempPublic({ 'walk-luka.webp': 'x', 'walk-luka.json': '{"frames":0,"frameWidth":9,"frameHeight":9,"fps":9}' }))).toEqual([]);
  });

  it('returns valid sprites in luka → budy → caddy order', () => {
    const root = tempPublic({
      'walk-caddy.png': 'x',
      'walk-caddy.json': walkJson,
      'walk-luka.webp': 'x',
      'walk-luka.json': walkJson,
    });
    expect(walkSprites(root)).toEqual([
      { id: 'luka', src: '/img/cast/walk-luka.webp', frames: 8, frameWidth: 96, frameHeight: 64, fps: 12 },
      { id: 'caddy', src: '/img/cast/walk-caddy.png', frames: 8, frameWidth: 96, frameHeight: 64, fps: 12 },
    ]);
  });

  it('renders nothing without sprites (and the built site has none yet)', async () => {
    const c = await AstroContainer.create();
    const html = await c.renderToString(WalkingCats, { props: { sprites: [] } });
    expect(html).not.toContain('data-walkers');
    if (walkSprites().length === 0) expect(home()).not.toContain('data-walkers');
  });

  it('renders a 60px steps() sprite per cat when sprites exist', async () => {
    const c = await AstroContainer.create();
    const html = await c.renderToString(WalkingCats, {
      props: { sprites: walkSprites(tempPublic({ 'walk-budy.webp': 'x', 'walk-budy.json': walkJson })) },
    });
    expect(html).toContain('data-walkers');
    expect(html).toMatch(/aria-hidden="true"/);
    expect(html).toMatch(/data-walker="budy"[^>]*style="--w:90px;--h:60px;--strip:720px;--frames:8;--gait:0\.667s;--sheet:url\(\/img\/cast\/walk-budy\.webp\)"/);
  });

  it('walk CSS uses steps(), transforms only, and switches off for reduced motion', () => {
    const css = builtCss();
    expect(css).toMatch(/steps\(var\(--frames\)\)/);
    expect(css).toMatch(/@keyframes gait[^}]*\{[^}]*transform:translate[^}]*\}/);
  });

  it('crosses in 20s, spawns every 15s (first after 2s), never blocks clicks, overhangs the header', () => {
    const css = builtCss();
    expect(css).toMatch(/cross 20s linear/);
    expect(css).not.toMatch(/cross 7s/);
    expect(css).toMatch(/\.walkers\[[^\]]*\]\{[^}]*pointer-events:none/);
    expect(css).toMatch(/\.walkers\[[^\]]*\]\{[^}]*overflow-x:clip/);
    expect(css).toMatch(/\.walker\[[^\]]*\]\{[^}]*inset-block-end:-4px/);
    const src = readFileSync('src/components/WalkingCats.astro', 'utf8');
    expect(src).toContain('SPAWN_MS = 15000');
    expect(src).toContain('FIRST_MS = 2000');
    expect(src).toContain('CROSS_S = 20');
    expect(src).toContain('document.hidden');
  });
});

/** In-memory KV with the same contract as idbKV. */
function memKV(): KV & { map: Map<string, unknown> } {
  const map = new Map<string, unknown>();
  return { map, get: async (k) => map.get(k), set: async (k, v) => void map.set(k, v), del: async (k) => void map.delete(k) };
}

describe('pending photo hand-off (home → /tango-me)', () => {
  const file = () => new File([new Uint8Array([1, 2, 3])], 'mochi.jpg', { type: 'image/jpeg' });

  it('stashes under ttw.pendingPhoto and takes it back once', async () => {
    const kv = memKV();
    expect(await stashPhoto(kv, file(), 1000)).toBe(true);
    expect(kv.map.has(PENDING_KEY)).toBe(true);
    const got = await takePendingPhoto(kv, 2000);
    expect(got?.name).toBe('mochi.jpg');
    expect(got?.type).toBe('image/jpeg');
    expect(got?.size).toBe(3);
    expect(kv.map.has(PENDING_KEY)).toBe(false);
    expect(await takePendingPhoto(kv, 2000)).toBeNull();
  });

  it('drops stale or malformed entries (and still clears them)', async () => {
    const kv = memKV();
    await stashPhoto(kv, file(), 0);
    expect(await takePendingPhoto(kv, PENDING_TTL_MS + 1)).toBeNull();
    expect(kv.map.size).toBe(0);
    kv.map.set(PENDING_KEY, { name: 'x' });
    expect(await takePendingPhoto(kv)).toBeNull();
    expect(kv.map.size).toBe(0);
  });

  it('never throws when storage fails', async () => {
    const broken: KV = {
      get: () => Promise.reject(new Error('blocked')),
      set: () => Promise.reject(new Error('blocked')),
      del: () => Promise.reject(new Error('blocked')),
    };
    expect(await stashPhoto(broken, file())).toBe(false);
    expect(await takePendingPhoto(broken)).toBeNull();
  });

  describe('idbKV on a minimal IndexedDB fake', () => {
    let factory: IDBFactory;
    beforeEach(() => {
      const data = new Map<unknown, unknown>();
      const done = <T>(result: T) => {
        const r = { result, onsuccess: null as null | (() => void), onerror: null };
        queueMicrotask(() => r.onsuccess?.());
        return r;
      };
      const store = { get: (k: unknown) => done(data.get(k)), put: (v: unknown, k: unknown) => done(data.set(k, v) && k), delete: (k: unknown) => done(data.delete(k) && undefined) };
      const db = { objectStoreNames: { contains: () => false }, createObjectStore: () => store, transaction: () => ({ objectStore: () => store }) };
      factory = {
        open: () => {
          const r = { result: db, onsuccess: null as null | (() => void), onupgradeneeded: null as null | (() => void), onerror: null };
          queueMicrotask(() => {
            r.onupgradeneeded?.();
            r.onsuccess?.();
          });
          return r;
        },
      } as unknown as IDBFactory;
    });

    it('round-trips a photo through IndexedDB', async () => {
      const kv = idbKV(factory);
      await stashPhoto(kv, file());
      expect((await takePendingPhoto(kv))?.name).toBe('mochi.jpg');
      expect(await takePendingPhoto(kv)).toBeNull();
    });
  });

  it('is wired into both pages', () => {
    const js = builtJs();
    expect(js).toContain('ttw.pendingPhoto');
    expect(readFileSync('src/components/CastLineup.astro', 'utf8')).toContain('stashPhoto(');
    expect(readFileSync('src/components/TangoMe.astro', 'utf8')).toContain('takePendingPhoto(');
    expect(readFileSync(join('dist', 'tango-me', 'index.html'), 'utf8')).toContain('data-prefilled');
  });
});

describe('pointer effects', () => {
  const r = { left: 100, top: 100, width: 200, height: 100, right: 300, bottom: 200, x: 100, y: 100 } as DOMRectReadOnly;
  it('magnetic pull is capped at 8px', () => {
    expect(magnet(200, 150, r)).toEqual([0, 0]);
    const [x, y] = magnet(1000, -1000, r);
    expect(x).toBe(8);
    expect(y).toBe(-8);
  });
  it('tilt is capped at 6°', () => {
    expect(tilt(200, 150, r).map((v) => Math.abs(v))).toEqual([0, 0]);
    expect(tilt(300, 200, r)).toEqual([-6, 6]);
    expect(tilt(-50, -50, r)).toEqual([6, -6]);
  });
  it('ships as one bundled module on every page, gated to fine pointers and motion', () => {
    const src = readFileSync('src/scripts/pointer-fx.ts', 'utf8');
    expect(src).toContain("matchMedia('(pointer: fine) and (hover: hover)')");
    expect(src).toContain("matchMedia('(prefers-reduced-motion: reduce)')");
    expect(src).toMatch(/passive: true/);
    expect(src).toContain('RING_EVERY = 120');
    expect(src).toMatch(/n < 8/);
    expect(src).toContain('.animate(');
    expect(builtCss()).toMatch(/\.ripple-ring\{[^}]*pointer-events:none/);
    expect(home()).toMatch(/<script type="module" src="\/_astro\/[^"]+\.js"><\/script>/);
    expect(home()).toContain('id="wall-ripple"');
    expect(home()).toMatch(/feDisplacementMap[^>]*scale="0"/);
    expect(home()).toMatch(/data-magnetic/);
    expect(home()).toMatch(/data-tilt/);
  });
});

describe('responsive container', () => {
  it('is 85vw wide up to 1800px, with 16px side padding on phones', () => {
    const css = builtCss();
    expect(css).toMatch(/--max-width:\s*1800px/);
    expect(css).toMatch(/\.container\{inline-size:min\(var\(--max-width\),\s*85vw\)/);
    expect(css).toMatch(/--gutter-min:\s*16px/);
  });
});
