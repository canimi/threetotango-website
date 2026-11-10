import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain ESM module without types
import { checkFeed, feedHash, releasesToPrune } from '../deploy/site-builder.mjs';

describe('site builder', () => {
  it('rejects feeds that look like an outage', () => {
    expect(checkFeed('not json', 0).ok).toBe(false);
    expect(checkFeed('{"a":1}', 0).ok).toBe(false);
    expect(checkFeed('[]', 0).ok).toBe(false);
    expect(checkFeed('[1,2]', 10).ok).toBe(false);
    expect(checkFeed('[1,2,3,4,5]', 10).ok).toBe(true);
    expect(checkFeed('[1]', 0).ok).toBe(true);
  });
  it('hashes the feed text', () => {
    expect(feedHash('a')).toBe(feedHash('a'));
    expect(feedHash('a')).not.toBe(feedHash('b'));
  });
  it('prunes all but the live release and the two newest others', () => {
    expect(releasesToPrune(['baked-100', 'b-200', 'b-300', 'b-400', 'b-500'], 'b-500').sort()).toEqual(['b-200', 'baked-100']);
    expect(releasesToPrune(['baked-900', 'b-200', 'b-300'], 'baked-900')).toEqual([]);
    expect(releasesToPrune(['b-1', 'b-2', 'b-3', 'b-4'], 'b-1').sort()).toEqual(['b-2']);
  });
});

describe('deploy wiring', () => {
  const compose = readFileSync('docker-compose.yml', 'utf8');
  const docker = readFileSync('deploy/Dockerfile', 'utf8');
  const nginx = readFileSync('deploy/nginx.conf', 'utf8');
  it('nginx serves the live release from the shared volume', () => {
    expect(nginx).toContain('root /srv/site/current;');
    expect(compose).toMatch(/ttw-web:[\s\S]*- ttw_site:\/srv\/site[\s\S]*ttw-builder:/);
  });
  it('has a builder service on the n8n network with the shared volume', () => {
    expect(compose).toMatch(/ttw-builder:[\s\S]*target: builder[\s\S]*- ttw_site:\/srv\/site[\s\S]*- n8n/);
    expect(compose).toMatch(/ttw-web:[\s\S]*target: web/);
  });
  it('Dockerfile has builder + web stages and seeds the baked site', () => {
    expect(docker).toContain('FROM build AS builder');
    expect(docker).toContain('CMD ["node", "deploy/site-builder.mjs"]');
    expect(docker).toContain('FROM nginx:alpine AS web');
    expect(docker).toContain('/docker-entrypoint.d/05-ttw-seed-site.sh');
  });
});
