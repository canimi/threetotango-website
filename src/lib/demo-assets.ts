import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface DemoAssets {
  before: string | null;
  after: string | null;
  story: string | null;
}

/** Build-time check for the optional Tango Me demo images in public/img/tango/. */
export function demoAssets(root: string = process.cwd()): DemoAssets {
  const has = (name: string) =>
    existsSync(join(root, 'public', 'img', 'tango', name)) ? `/img/tango/${name}` : null;
  const before = has('demo-before.jpg');
  const after = has('demo-after.jpg');
  // The reveal needs both halves.
  if (!before || !after) return { before: null, after: null, story: has('demo-story.jpg') };
  return { before, after, story: has('demo-story.jpg') };
}
