import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** All CSS the build ships: external files in dist/_astro plus <style> blocks inlined into pages
 *  (astro.config inlines stylesheets to avoid render-blocking requests). */
export function builtCss(dir = 'dist'): string {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.css')) out.push(readFileSync(p, 'utf8'));
      else if (e.name.endsWith('.html')) {
        for (const m of readFileSync(p, 'utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) out.push(m[1]);
      }
    }
  };
  walk(dir);
  return out.join('\n');
}
