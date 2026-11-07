import { describe, it, expect, vi, afterEach } from 'vitest';
import { api } from '../src/lib/api';

const reply = (status: number, body: unknown) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

afterEach(() => vi.unstubAllGlobals());

describe('api.subscribe', () => {
  it('posts JSON to /api/subscribe', async () => {
    const f = vi.fn().mockResolvedValue(reply(200, { ok: true }));
    vi.stubGlobal('fetch', f);
    expect(await api.subscribe('a@b.co', 'gift')).toEqual({ ok: true });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('/api/subscribe');
    expect(init.method).toBe('POST');
    expect(init.headers['content-type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ email: 'a@b.co', source: 'gift' });
  });
  it('maps 429 to rate_limited', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(429, '')));
    expect(await api.subscribe('a@b.co', 'footer')).toEqual({ ok: false, error: 'rate_limited' });
  });
  it('maps 500 to server', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(500, 'boom')));
    expect(await api.subscribe('a@b.co', 'footer')).toEqual({ ok: false, error: 'server' });
  });
  it('maps body error invalid_email', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(400, { ok: false, error: 'invalid_email' })));
    expect(await api.subscribe('x', 'gift')).toEqual({ ok: false, error: 'invalid_email' });
  });
  it('never throws on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    expect(await api.subscribe('a@b.co', 'gift')).toEqual({ ok: false, error: 'server' });
  });
  it('unknown body error falls back to status mapping', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(429, { ok: false, error: 'weird' })));
    expect(await api.subscribe('a@b.co', 'gift')).toEqual({ ok: false, error: 'rate_limited' });
  });
});

describe('api.verify', () => {
  it('returns the token on success', async () => {
    const f = vi.fn().mockResolvedValue(reply(200, { ok: true, token: 'tok' }));
    vi.stubGlobal('fetch', f);
    expect(await api.verify('a@b.co', '123456')).toEqual({ ok: true, token: 'tok' });
    expect(f.mock.calls[0][0]).toBe('/api/verify');
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ email: 'a@b.co', code: '123456' });
  });
  it('maps body error expired', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(410, { ok: false, error: 'expired' })));
    expect(await api.verify('a@b.co', '123456')).toEqual({ ok: false, error: 'expired' });
  });
  it.each([['wrong_code', 401], ['locked', 423]])('maps %s', async (error, status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(status, { ok: false, error })));
    expect(await api.verify('a@b.co', '123456')).toEqual({ ok: false, error });
  });
  it.each(['12345', '1234567', 'abcdef', '12 456', ''])('rejects code %j without fetch', async (code) => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    expect(await api.verify('a@b.co', code)).toEqual({ ok: false, error: 'wrong_code' });
    expect(f).not.toHaveBeenCalled();
  });
  it('treats success without token as server error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(200, { ok: true })));
    expect(await api.verify('a@b.co', '123456')).toEqual({ ok: false, error: 'server' });
  });
});
