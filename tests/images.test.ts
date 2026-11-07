import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function htmlFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? htmlFiles(p) : p.endsWith('.html') ? [p] : [];
  });
}

describe('built pages only reference images that exist', () => {
  it('every <img src="/img/..."> exists in public/ (runtime /media/* excluded)', () => {
    const missing: string[] = [];
    for (const f of htmlFiles('dist')) {
      const html = readFileSync(f, 'utf8');
      for (const m of html.matchAll(/<img\b[^>]*?\bsrc="(\/img\/[^"?#]+)"/g)) {
        if (!existsSync(join('public', m[1]))) missing.push(`${f}: ${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('docker build freshness', () => {
  const df = readFileSync('deploy/Dockerfile', 'utf8');
  it('bakes the feed in with a remote ADD before the build step', () => {
    const add = df.indexOf('ADD https://n8n.canimi.app/webhook/ttw-episodes /tmp/episodes.json');
    expect(add).toBeGreaterThan(-1);
    expect(add).toBeLessThan(df.indexOf('RUN npm run build'));
    expect(df).toContain('EPISODES_FILE=/tmp/episodes.json');
  });
  it('compose always rebuilds ttw-web', () => {
    expect(readFileSync('docker-compose.yml', 'utf8')).toContain('pull_policy: build');
  });
});
