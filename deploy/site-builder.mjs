// Three To Tango — site builder (runs in the ttw-builder container).
//
// Keeps the static site in step with the episode feed without Portainer or GitHub:
//   1. On start it builds the site once (new code after a redeploy goes live within a minute).
//   2. Every POLL_SECONDS it fetches the episode feed from n8n; when the feed changed it rebuilds.
//   3. Each build goes into its own release folder; only a finished, checked build is switched live
//      (atomic symlink swap of /srv/site/current), so a failed build never breaks the site.
//
// nginx (ttw-web) serves /srv/site/current from the shared volume ttw_site.

import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { access, cp, mkdir, readdir, readlink, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const SITE_DIR = process.env.SITE_DIR || '/srv/site';
const APP_DIR = process.env.APP_DIR || '/app';
const FEED_URLS = [
  process.env.FEED_URL || 'http://n8n-docker-n8n-1:5678/webhook/ttw-episodes',
  process.env.FEED_FALLBACK_URL || 'https://n8n.canimi.app/webhook/ttw-episodes',
];
const POLL_MS = Math.max(30, Number(process.env.POLL_SECONDS || 600)) * 1000;
const KEEP_OLD_RELEASES = 2;

const log = (...a) => console.log(new Date().toISOString(), '[site-builder]', ...a);

export function feedHash(text) {
  return createHash('sha256').update(text).digest('hex');
}

/**
 * Accept a feed only if it is a JSON array and does not look like an outage
 * (empty, or less than half of the last published episode count).
 */
export function checkFeed(text, lastCount) {
  let list;
  try {
    list = JSON.parse(text);
  } catch {
    return { ok: false, why: 'not JSON' };
  }
  if (!Array.isArray(list)) return { ok: false, why: 'not an array' };
  if (list.length === 0) return { ok: false, why: 'empty list' };
  if (lastCount > 0 && list.length < lastCount / 2) {
    return { ok: false, why: `only ${list.length} episodes (last build had ${lastCount})` };
  }
  return { ok: true, list };
}

/** Release folders to delete: everything except the live one and the newest `keep` others. */
export function releasesToPrune(names, live, keep = KEEP_OLD_RELEASES) {
  const stamp = (n) => Number(n.split('-').pop()) || 0;
  const others = names.filter((n) => n !== live).sort((a, b) => stamp(b) - stamp(a));
  return others.slice(keep);
}

async function fetchFeed() {
  let lastErr;
  for (const url of FEED_URLS) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
      log(`feed ${url} failed:`, err instanceof Error ? err.message : err);
    }
  }
  throw lastErr ?? new Error('no feed url');
}

function run(cmd, args, env) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: APP_DIR, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let tail = '';
    const keep = (d) => {
      tail = (tail + d.toString()).slice(-4000);
    };
    p.stdout.on('data', keep);
    p.stderr.on('data', keep);
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}\n${tail}`))));
  });
}

async function liveRelease() {
  try {
    return (await readlink(join(SITE_DIR, 'current'))).split('/').pop() ?? '';
  } catch {
    return '';
  }
}

async function swapLive(release) {
  const tmp = join(SITE_DIR, `.current-${process.pid}-${Date.now()}`);
  await symlink(join('releases', release), tmp);
  await rename(tmp, join(SITE_DIR, 'current')); // atomic: replaces the old symlink in one step
}

async function prune() {
  const releasesDir = join(SITE_DIR, 'releases');
  const names = await readdir(releasesDir).catch(() => []);
  for (const name of releasesToPrune(names, await liveRelease())) {
    await rm(join(releasesDir, name), { recursive: true, force: true });
  }
}

async function build(text, list, hash) {
  const release = `b-${Date.now()}`;
  const feedFile = `/tmp/episodes-${release}.json`;
  const target = join(SITE_DIR, 'releases', release);
  await writeFile(feedFile, text);
  try {
    await run('npx', ['astro', 'build'], { EPISODES_FILE: feedFile });
    await access(join(APP_DIR, 'dist', 'index.html'));
    await access(join(APP_DIR, 'dist', 'episodes', 'index.html'));
    await mkdir(join(SITE_DIR, 'releases'), { recursive: true });
    await cp(join(APP_DIR, 'dist'), target, { recursive: true });
    const info = { builtAt: new Date().toISOString(), episodes: list.length, latest: list[0]?.slug ?? null, feedHash: hash.slice(0, 12) };
    await writeFile(join(target, 'build-info.json'), JSON.stringify(info) + '\n');
    await swapLive(release);
    log(`live: ${release} (${list.length} episodes, latest ${info.latest})`);
  } catch (err) {
    await rm(target, { recursive: true, force: true });
    throw err;
  } finally {
    await rm(feedFile, { force: true });
  }
  await prune().catch((err) => log('prune failed:', err instanceof Error ? err.message : err));
}

async function main() {
  await mkdir(join(SITE_DIR, 'releases'), { recursive: true });
  let lastHash = '';
  let lastCount = 0;
  let first = true;
  log(`started; polling every ${POLL_MS / 1000}s`);
  for (;;) {
    try {
      const text = await fetchFeed();
      const hash = feedHash(text);
      if (first || hash !== lastHash) {
        const check = checkFeed(text, lastCount);
        if (!check.ok) {
          log(`feed rejected (${check.why}); keeping the live site`);
        } else {
          log(first ? 'initial build' : 'feed changed, rebuilding');
          await build(text, check.list, hash);
          lastHash = hash;
          lastCount = check.list.length;
          first = false;
        }
      }
    } catch (err) {
      log('cycle failed, live site unchanged:', err instanceof Error ? err.message : err);
    }
    await new Promise((r) => setTimeout(r, first ? 60000 : POLL_MS));
  }
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
