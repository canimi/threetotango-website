import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { api, CHAT_CATS } from '../src/lib/api';

const page = (p: string) => readFileSync(join('dist', p), 'utf8');

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
  vi.stubGlobal('fetch', fn);
  return fn;
}
afterEach(() => vi.unstubAllGlobals());

describe('chat api client', () => {
  it('starts a chat and keeps only a valid session and guest', async () => {
    const f = mockFetch(200, {
      ok: true,
      session: 'qLtPw6M1Ta6wHQIm',
      cat: 'budy',
      greeting: 'HI!',
      guest: { name: 'Pistachio', image: '/media/tango/x-post.jpg' },
      guestMissing: false,
      maxMessages: 20,
    });
    const r = await api.chatStart('budy', { token: 'tok', bring: true });
    expect(r).toMatchObject({ ok: true, session: 'qLtPw6M1Ta6wHQIm', guest: { name: 'Pistachio' }, maxMessages: 20 });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/chat/start');
    expect(JSON.parse(String(init.body))).toEqual({ cat: 'budy', token: 'tok', bring: true });
  });

  it('rejects an unknown cat without calling the server', async () => {
    const f = mockFetch(200, {});
    // @ts-expect-error invalid on purpose
    expect(await api.chatStart('nora')).toEqual({ ok: false, error: 'invalid' });
    expect(f).not.toHaveBeenCalled();
  });

  it('passes the cat’s own message through on limits and sleep', async () => {
    mockFetch(200, { ok: false, error: 'sleeping', cat: 'luka', message: 'Shh.' });
    expect(await api.chatStart('luka')).toEqual({ ok: false, error: 'sleeping', message: 'Shh.' });
    mockFetch(429, { ok: false, error: 'rate_limited', message: 'Tomorrow.' });
    expect(await api.chatSend('qLtPw6M1Ta6wHQIm', 'hi')).toEqual({ ok: false, error: 'rate_limited', message: 'Tomorrow.' });
    mockFetch(200, { ok: false, error: 'session_limit', message: 'Tired.', cta: 'tango' });
    expect(await api.chatSend('qLtPw6M1Ta6wHQIm', 'hi')).toEqual({ ok: false, error: 'session_limit', message: 'Tired.', cta: 'tango' });
  });

  it('maps statuses when the body has no known error', async () => {
    mockFetch(404, null);
    expect(await api.chatSend('qLtPw6M1Ta6wHQIm', 'hi')).toMatchObject({ error: 'expired' });
    mockFetch(503, { ok: false });
    expect(await api.chatSend('qLtPw6M1Ta6wHQIm', 'hi')).toMatchObject({ error: 'busy' });
  });

  it('validates text and session before sending', async () => {
    const f = mockFetch(200, {});
    expect(await api.chatSend('short', 'hi')).toEqual({ ok: false, error: 'invalid' });
    expect(await api.chatSend('qLtPw6M1Ta6wHQIm', '   ')).toEqual({ ok: false, error: 'invalid' });
    expect(await api.chatSend('qLtPw6M1Ta6wHQIm', 'x'.repeat(301))).toEqual({ ok: false, error: 'invalid' });
    expect(f).not.toHaveBeenCalled();
  });

  it('returns the reply, remaining count and CTA', async () => {
    const f = mockFetch(200, { ok: true, cat: 'caddy', reply: 'Mm.', remaining: 15, cta: 'tango' });
    expect(await api.chatSend('qLtPw6M1Ta6wHQIm', '  hello   there ')).toEqual({
      ok: true,
      reply: 'Mm.',
      remaining: 15,
      cta: 'tango',
      flagged: false,
      help: false,
      closed: false,
    });
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ session: 'qLtPw6M1Ta6wHQIm', text: 'hello there' });
  });

  it('only offers the three cats (never Nora)', () => {
    expect([...CHAT_CATS]).toEqual(['luka', 'budy', 'caddy']);
  });
});

describe('chat page and entry points', () => {
  it('builds /chat with a picker for the three cats, the composer and the AI disclosure', () => {
    const h = page('chat/index.html');
    for (const id of CHAT_CATS) expect(h).toContain(`data-pick="${id}"`);
    expect(h).not.toContain('data-pick="nora"');
    expect(h).toContain('data-input');
    expect(h).toContain('written by an AI');
    expect(h).toContain('<link rel="canonical" href="https://threetotango.canimi.app/chat"');
  });
  it('puts a chat button in the header and the mobile menu', () => {
    const h = page('index.html');
    expect(h).toMatch(/<a class="btn head-chat[^"]*"[^>]*href="\/chat"/);
    expect((h.match(/href="\/chat"/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
  it('cat pages link to their own chat; Nora has none', () => {
    for (const id of CHAT_CATS) expect(page(`cats/${id}/index.html`)).toContain(`href="/chat?cat=${id}"`);
    expect(page('cats/nora/index.html')).not.toContain('/chat?cat=');
  });
  it('lists /chat in the sitemap', () => {
    expect(page('sitemap.xml')).toContain('<loc>https://threetotango.canimi.app/chat</loc>');
  });
});
