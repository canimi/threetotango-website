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

describe('CSP', () => {
  const csp = readFileSync('deploy/security-headers.conf', 'utf8');
  const directive = (n: string) => new RegExp(`${n} ([^;"]*)`).exec(csp)?.[1] ?? '';
  it('allows blob: images for upload preview', () => {
    expect(directive('img-src')).toContain('blob:');
  });
  it('does not allow inline scripts', () => {
    expect(directive('script-src')).not.toContain('unsafe-inline');
  });
});

describe('internal media endpoint (8081)', () => {
  const m = readFileSync('deploy/media-internal.conf.template', 'utf8');
  it('listens on 8081 with PUT/DELETE dav', () => {
    expect(m).toContain('listen 8081;');
    expect(m).toContain('dav_methods PUT DELETE;');
    expect(m).toContain('create_full_put_path on;');
    expect(m).toContain('client_max_body_size 50m;');
  });
  it('restricts to private ranges', () => {
    for (const r of ['172.16.0.0/12', '10.0.0.0/8', '192.168.0.0/16']) expect(m).toContain(`allow ${r};`);
    expect(m).toContain('deny all;');
  });
  it('checks X-TTW-Key', () => {
    expect(m).toContain('$http_x_ttw_key != "${TTW_MEDIA_KEY}"');
    expect(m).toMatch(/\$http_x_ttw_key = ""\) \{\s*return 401;/);
  });
  it('public :80 conf stays read-only and has no dav', () => {
    expect(conf).not.toContain('dav_methods');
    expect(conf).toMatch(/location \^~ \/media\/uploads\/ \{\s*return 404;/);
  });
});
