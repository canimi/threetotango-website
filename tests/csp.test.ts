import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function htmlFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? htmlFiles(p) : p.endsWith('.html') ? [p] : [];
  });
}

describe('strict CSP compatibility', () => {
  it('has no inline <script> in built HTML', () => {
    const bad: string[] = [];
    for (const f of htmlFiles('dist')) {
      const html = readFileSync(f, 'utf8');
      for (const m of html.matchAll(/<script\b([^>]*)>/g)) {
        if (!/\bsrc=/.test(m[1]) && !/application\/ld\+json/.test(m[1])) bad.push(f);
      }
    }
    expect(bad).toEqual([]);
  });
});
