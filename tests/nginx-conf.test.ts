import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const conf = readFileSync('deploy/nginx.conf', 'utf8');

describe('nginx.conf', () => {
  it.each([
    ['= /api/subscribe', '/webhook/ttw-subscribe'],
    ['= /api/verify', '/webhook/ttw-verify'],
    ['= /api/waitlist', '/webhook/ttw-waitlist'],
    ['= /api/tango/start', '/webhook/ttw-tango-start'],
    ['/api/tango/status/', '/webhook/ttw-tango-status?id=$1'],
    ['/tango-me/r/', '/webhook/ttw-tango-share?id=$1'],
  ])('maps %s to %s', (loc, target) => {
    expect(conf).toContain(loc);
    expect(conf).toContain(`$n8n${target}`);
  });
  it('validates ids and 404s the rest of /api/', () => {
    expect(conf).toContain('([A-Za-z0-9_-]{1,64})$');
    expect(conf).toMatch(/location \/api\/ \{\s*return 404;/);
  });
  it('denies raw uploads', () => {
    expect(conf).toMatch(/location \^~ \/media\/uploads\/ \{\s*return 404;/);
  });
  it('has body limit and resolver', () => {
    expect(conf).toContain('client_max_body_size 12m;');
    expect(conf).toContain('resolver 127.0.0.11 valid=30s;');
  });
});
