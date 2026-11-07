import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  validateUpload,
  pollStatus,
  saveActive,
  loadActive,
  clearActive,
  saveToken,
  loadToken,
  clearToken,
  stepAfterFailure,
  isTerminal,
  createSubmitter,
  MAX_UPLOAD_BYTES,
} from '../src/lib/tango-flow';
import { api } from '../src/lib/api';
import { normalizeCode } from '../src/lib/validate';

const MB10 = 10 * 1024 * 1024;

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}
const brokenStorage = () => ({
  getItem: () => {
    throw new Error('denied');
  },
  setItem: () => {
    throw new Error('denied');
  },
  removeItem: () => {
    throw new Error('denied');
  },
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('validateUpload', () => {
  it('accepts jpeg, png, heic, heif', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/heic', 'image/heif'])
      expect(validateUpload({ type, size: 1000, name: 'a' })).toBe('ok');
  });
  it('accepts empty type with .HEIC extension', () => {
    expect(validateUpload({ type: '', size: 1000, name: 'IMG_1.HEIC' })).toBe('ok');
    expect(validateUpload({ type: '', size: 1000, name: 'x.heif' })).toBe('ok');
  });
  it('rejects empty type without heic extension', () => {
    expect(validateUpload({ type: '', size: 1000, name: 'x.bmp' })).toBe('type');
  });
  it('allows exactly 10 MB, rejects 10 MB + 1', () => {
    expect(MAX_UPLOAD_BYTES).toBe(MB10);
    expect(validateUpload({ type: 'image/png', size: MB10, name: 'a.png' })).toBe('ok');
    expect(validateUpload({ type: 'image/png', size: MB10 + 1, name: 'a.png' })).toBe('size');
  });
  it('rejects gif', () => {
    expect(validateUpload({ type: 'image/gif', size: 10, name: 'a.gif' })).toBe('type');
  });
  it('type check wins over size', () => {
    expect(validateUpload({ type: 'image/gif', size: MB10 + 1, name: 'a.gif' })).toBe('type');
  });
});

describe('pollStatus', () => {
  it('resolves on done', async () => {
    const status = vi
      .fn()
      .mockResolvedValueOnce({ status: 'queued' })
      .mockResolvedValueOnce({ status: 'running' })
      .mockResolvedValueOnce({ status: 'done', urls: { post: 'p', story: 's' }, share: 'x' });
    const r = await pollStatus('id1', { intervalMs: 1, timeoutMs: 1000, status });
    expect(r.status).toBe('done');
    expect(status).toHaveBeenCalledTimes(3);
    expect(status).toHaveBeenCalledWith('id1');
  });
  it('resolves on failed with error', async () => {
    const status = vi.fn().mockResolvedValue({ status: 'failed', error: 'not_cat' });
    expect(await pollStatus('i', { intervalMs: 1, timeoutMs: 1000, status })).toEqual({
      status: 'failed',
      error: 'not_cat',
    });
  });
  it('rejects with timeout', async () => {
    vi.useFakeTimers();
    const status = vi.fn().mockResolvedValue({ status: 'running' });
    const p = pollStatus('i', { intervalMs: 100, timeoutMs: 1000, status });
    const assertion = expect(p).rejects.toBe('timeout');
    await vi.advanceTimersByTimeAsync(1500);
    await assertion;
  });
});

describe('active generation storage', () => {
  it('loadActive returns saved id after reload simulation', () => {
    const store = memoryStorage();
    vi.stubGlobal('localStorage', store);
    saveActive('gen-42');
    // "reload": same storage, fresh call
    expect(loadActive()).toBe('gen-42');
    clearActive();
    expect(loadActive()).toBeNull();
  });
  it('returns null and does not throw when localStorage throws', () => {
    vi.stubGlobal('localStorage', brokenStorage());
    expect(() => saveActive('x')).not.toThrow();
    expect(loadActive()).toBeNull();
    expect(() => clearActive()).not.toThrow();
  });
});

describe('token storage', () => {
  it('returns a saved token before expiry', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    saveToken('tok', 1_000);
    expect(loadToken(1_000 + 23 * 3600_000)).toBe('tok');
  });
  it('expires after 24h', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    saveToken('tok', 1_000);
    expect(loadToken(1_000 + 24 * 3600_000 + 1)).toBeNull();
  });
  it('ignores corrupt data and survives throwing storage', () => {
    const s = memoryStorage();
    s.setItem('ttw.token', '{nope');
    vi.stubGlobal('localStorage', s);
    expect(loadToken()).toBeNull();
    vi.stubGlobal('localStorage', brokenStorage());
    expect(() => saveToken('t')).not.toThrow();
    expect(loadToken()).toBeNull();
  });
});

describe('createSubmitter', () => {
  const form = () => {
    const fd = new FormData();
    fd.set('catName', 'Mochi');
    return fd;
  };
  it('submitting twice while in flight calls start once with one idemKey', async () => {
    let release!: (v: { ok: true; id: string }) => void;
    const start = vi.fn(
      (_fd: FormData) => new Promise<{ ok: true; id: string }>((res) => (release = res)),
    );
    const submit = createSubmitter(start).submit;
    const a = submit(form());
    const b = submit(form());
    expect(b).toBe(a);
    release({ ok: true, id: 'g1' });
    expect(await a).toEqual({ ok: true, id: 'g1' });
    expect(start).toHaveBeenCalledTimes(1);
    const sent = start.mock.calls[0][0] as unknown as FormData;
    expect(typeof sent.get('idemKey')).toBe('string');
    expect(String(sent.get('idemKey')).length).toBeGreaterThan(10);
  });
  it('reuses the idemKey on retry until reset()', async () => {
    const start = vi.fn().mockResolvedValue({ ok: false, error: 'server' });
    const s = createSubmitter(start);
    await s.submit(form());
    await s.submit(form());
    expect(start).toHaveBeenCalledTimes(2);
    const k1 = (start.mock.calls[0][0] as FormData).get('idemKey');
    const k2 = (start.mock.calls[1][0] as FormData).get('idemKey');
    expect(k1).toBe(k2);
    s.reset();
    await s.submit(form());
    expect((start.mock.calls[2][0] as FormData).get('idemKey')).not.toBe(k1);
  });
  it('releases the lock when start rejects', async () => {
    const start = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValue({ ok: true, id: 'i' });
    const s = createSubmitter(start);
    await expect(s.submit(form())).rejects.toThrow('x');
    expect(await s.submit(form())).toEqual({ ok: true, id: 'i' });
  });
});

describe('api.tangoStart / tangoStatus / waitlist', () => {
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
  it('tangoStart posts multipart FormData and returns id', async () => {
    const f = vi.fn().mockResolvedValue(reply(200, { ok: true, id: 'abc' }));
    vi.stubGlobal('fetch', f);
    const fd = new FormData();
    fd.set('catName', 'x');
    expect(await api.tangoStart(fd)).toEqual({ ok: true, id: 'abc' });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('/api/tango/start');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(fd);
    expect(init.headers).toBeUndefined();
  });
  it('tangoStart maps body error, 429 and network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(403, { ok: false, error: 'used' })));
    expect(await api.tangoStart(new FormData())).toEqual({ ok: false, error: 'used' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(429, '')));
    expect(await api.tangoStart(new FormData())).toEqual({ ok: false, error: 'rate_limited' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    expect(await api.tangoStart(new FormData())).toEqual({ ok: false, error: 'server' });
  });
  it('tangoStatus returns the body and treats network errors as running', async () => {
    const body = { status: 'done', urls: { post: 'p', story: 's' }, share: 'x' };
    const f = vi.fn().mockResolvedValue(reply(200, body));
    vi.stubGlobal('fetch', f);
    expect(await api.tangoStatus('a b')).toEqual(body);
    expect(f.mock.calls[0][0]).toBe('/api/tango/status/a%20b');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    expect(await api.tangoStatus('x')).toEqual({ status: 'running' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(500, 'boom')));
    expect(await api.tangoStatus('x')).toEqual({ status: 'running' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(200, { status: 'weird' })));
    expect(await api.tangoStatus('x')).toEqual({ status: 'running' });
  });
  it('waitlist posts JSON', async () => {
    const f = vi.fn().mockResolvedValue(reply(200, { ok: true }));
    vi.stubGlobal('fetch', f);
    expect(await api.waitlist('t', 'hd', 'g1')).toEqual({ ok: true });
    expect(f.mock.calls[0][0]).toBe('/api/waitlist');
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ token: 't', kind: 'hd', generationId: 'g1' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(500, '')));
    expect(await api.waitlist('t', 'mug', 'g1')).toEqual({ ok: false, error: 'server' });
  });
});

describe('normalizeCode', () => {
  it.each([
    ['123456', '123456'],
    ['123 456', '123456'],
    ['123-456', '123456'],
    [' 12 34\t56\n', '123456'],
    ['abc', ''],
  ])('%j -> %j', (i, o) => expect(normalizeCode(i)).toBe(o));
});

describe('stepAfterFailure / isTerminal / clearToken', () => {
  it('not_cat always goes to step 1', () => {
    expect(stepAfterFailure('not_cat', { hasPhoto: true, hasToken: true })).toBe(1);
  });
  it('no photo (resume/reload) goes to step 1', () => {
    expect(stepAfterFailure('server', { hasPhoto: false, hasToken: true })).toBe(1);
    expect(stepAfterFailure(undefined, { hasPhoto: false, hasToken: false })).toBe(1);
  });
  it('bad_token or missing token goes to step 4', () => {
    expect(stepAfterFailure('bad_token', { hasPhoto: true, hasToken: true })).toBe(4);
    expect(stepAfterFailure('server', { hasPhoto: true, hasToken: false })).toBe(4);
  });
  it('otherwise step 3', () => {
    expect(stepAfterFailure('server', { hasPhoto: true, hasToken: true })).toBe(3);
  });
  it('only done/failed are terminal (running keeps the active id)', () => {
    expect(isTerminal('done')).toBe(true);
    expect(isTerminal('failed')).toBe(true);
    expect(isTerminal('running')).toBe(false);
    expect(isTerminal('queued')).toBe(false);
  });
  it('clearToken removes the token and never throws', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    saveToken('t');
    clearToken();
    expect(loadToken()).toBeNull();
    vi.stubGlobal('localStorage', brokenStorage());
    expect(() => clearToken()).not.toThrow();
  });
});

describe('bad_token mapping', () => {
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
  it('tangoStart maps 401 and body bad_token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(401, {})));
    expect(await api.tangoStart(new FormData())).toEqual({ ok: false, error: 'bad_token' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(400, { ok: false, error: 'bad_token' })));
    expect(await api.tangoStart(new FormData())).toEqual({ ok: false, error: 'bad_token' });
  });
  it('waitlist maps 401 to bad_token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(401, { ok: false, error: 'bad_token' })));
    expect(await api.waitlist('t', 'hd', 'g')).toEqual({ ok: false, error: 'bad_token' });
  });
});
