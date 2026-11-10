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
    ['= /api/gallery', '/webhook/ttw-gallery$is_args$args'],
    ['= /api/gallery/like', '/webhook/ttw-gallery-like'],
    ['= /api/gallery/optin', '/webhook/ttw-gallery-optin'],
    ['= /gallery/mod', '/webhook/ttw-gallery-mod$is_args$args'],
  ])('maps %s to %s', (loc, target) => {
    expect(conf).toContain(loc);
    expect(conf).toContain(`$n8n${target}`);
  });
  it('caches gallery list 30s', () => {
    expect(conf).toMatch(
      /location = \/api\/gallery \{[^}]*add_header Cache-Control "public, max-age=30";[^}]*include \/etc\/nginx\/snippets\/ttw-security\.conf;/,
    );
  });
  it('does not cache gallery list errors (no always flag)', () => {
    expect(conf).not.toMatch(/Cache-Control "public, max-age=30" always/);
  });
  it('gallery mod page hides n8n Referrer-Policy', () => {
    expect(conf).toMatch(/= \/gallery\/mod \{[^}]*proxy_hide_header Referrer-Policy;/);
  });
  it('limits JSON bodies', () => {
    for (const loc of ['= /api/gallery/like', '= /api/gallery/optin']) {
      expect(conf).toMatch(new RegExp(`location ${loc.replace(/[/]/g, '\\/')} \\{[^}]*client_max_body_size 2k;`));
    }
  });
  it('validates ids and 404s the rest of /api/', () => {
    expect(conf).toContain('([A-Za-z0-9_-]{1,64})$');
    expect(conf).toMatch(/location \/api\/ \{\s*return 404;/);
  });
  it('denies raw uploads', () => {
    expect(conf).toMatch(/location \^~ \/media\/uploads\/ \{\s*return 404;/);
  });
  it('keeps redirects relative (no http:// behind the tunnel)', () => {
    expect(conf).toContain('absolute_redirect off;');
  });
  it('serves canonical no-slash URLs without a redirect and 301s the slash variant', () => {
    expect(conf).toMatch(/location \/ \{[^}]*rewrite \^\(\/\.\+\)\/\$ \$1 permanent;[^}]*try_files \$uri \$uri\/index\.html =404;/);
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

describe('proxy key (R13)', () => {
  const p = readFileSync('deploy/ttw-proxy.inc.template', 'utf8');
  it('sets X-TTW-Proxy-Key from env on proxied requests', () => {
    expect(p).toContain('proxy_set_header X-TTW-Proxy-Key "${TTW_PROXY_KEY}";');
  });
  it('every proxy location includes the rendered proxy snippet', () => {
    expect(conf.match(/include \/etc\/nginx\/conf\.d\/ttw-proxy\.inc;/g)?.length).toBe(10);
  });
  it('media root cannot be deleted', () => {
    const m = readFileSync('deploy/media-internal.conf.template', 'utf8');
    expect(m).toMatch(/location = \/media\/ \{\s*return 405;/);
  });
});

describe('deploy prep', () => {
  it('share location hides n8n CSP', () => {
    expect(conf).toMatch(/ttw-tango-share\?id=\$1;\s*[^}]*proxy_hide_header Content-Security-Policy;/);
  });
  it('gallery mod page hides n8n CSP', () => {
    expect(conf).toMatch(/= \/gallery\/mod \{[^}]*proxy_hide_header Content-Security-Policy;/);
  });
  it('hides X-Powered-By on proxied locations', () => {
    expect(readFileSync('deploy/ttw-proxy.inc.template', 'utf8')).toContain('proxy_hide_header X-Powered-By;');
  });
  it('main compose has no umami and requires only the two keys', () => {
    const c = readFileSync('docker-compose.yml', 'utf8');
    expect(c).not.toMatch(/umami:|UMAMI_DB|UMAMI_APP/);
    const req = [...c.matchAll(/\$\{(\w+):\?/g)].map((m) => m[1]).sort();
    expect(req).toEqual(['TTW_MEDIA_KEY', 'TTW_PROXY_KEY']);
    expect(readFileSync('docker-compose.umami.yml', 'utf8')).toContain('UMAMI_APP_SECRET:?');
  });
});

describe('compose build (BuildKit)', () => {
  const c = readFileSync('docker-compose.yml', 'utf8');
  it('has no build.network and fetches episodes via the public URL', () => {
    expect(c).not.toMatch(/^\s{6}network:/m);
    expect(c).toContain('https://n8n.canimi.app/webhook/ttw-episodes');
  });
  it('still attaches to the external n8n network at runtime', () => {
    expect(c).toMatch(/external: true/);
  });
});
