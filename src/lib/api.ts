import { isValidCode } from './validate';

export type Source = 'gift' | 'tango-me' | 'footer';
export type SubscribeError = 'invalid_email' | 'rate_limited' | 'server';
export type VerifyError = 'wrong_code' | 'expired' | 'locked' | 'server';

type Fail<E extends string> = { ok: false; error: E };
type Raw = { status: number; body: Record<string, unknown> | null };

async function readBody(res: Response): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = await res.json();
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Shared by every endpoint. Never throws; network/parse failures yield body=null, status=0/actual. */
async function postJson(path: string, payload: unknown): Promise<Raw> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { status: res.status, body: await readBody(res) };
  } catch {
    return { status: 0, body: null };
  }
}

/** Body `error` wins when it is one of `known`; otherwise map by HTTP status. */
function failure<E extends string>(raw: Raw, known: readonly E[], byStatus: Record<number, E>, fallback: E): Fail<E> {
  const code = raw.body?.error;
  if (typeof code === 'string' && (known as readonly string[]).includes(code)) {
    return { ok: false, error: code as E };
  }
  return { ok: false, error: byStatus[raw.status] ?? fallback };
}

export type TangoStartError = 'not_cat' | 'used' | 'budget' | 'rate_limited' | 'invalid' | 'bad_token' | 'server';
export type StatusResult = {
  status: 'queued' | 'running' | 'done' | 'failed';
  urls?: { post: string; story: string };
  share?: string;
  error?: 'not_cat' | 'server';
};

/** Multipart variant (browser sets the boundary header itself). Never throws. */
async function postForm(path: string, body: FormData): Promise<Raw> {
  try {
    const res = await fetch(path, { method: 'POST', body });
    return { status: res.status, body: await readBody(res) };
  } catch {
    return { status: 0, body: null };
  }
}

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const TANGO_START_ERRORS = ['not_cat', 'used', 'budget', 'rate_limited', 'invalid', 'bad_token', 'server'] as const;
const STATUSES = ['queued', 'running', 'done', 'failed'] as const;
const SUBSCRIBE_ERRORS = ['invalid_email', 'rate_limited', 'server'] as const;
const VERIFY_ERRORS = ['wrong_code', 'expired', 'locked', 'server'] as const;

export const api = {
  async subscribe(email: string, source: Source): Promise<{ ok: true } | Fail<SubscribeError>> {
    const raw = await postJson('/api/subscribe', { email, source });
    if (raw.status === 200 && raw.body?.ok === true) return { ok: true };
    return failure(raw, SUBSCRIBE_ERRORS, { 429: 'rate_limited' }, 'server');
  },

  async verify(email: string, code: string): Promise<{ ok: true; token: string } | Fail<VerifyError>> {
    if (!isValidCode(code)) return { ok: false, error: 'wrong_code' };
    const raw = await postJson('/api/verify', { email, code });
    if (raw.status === 200 && raw.body?.ok === true && typeof raw.body.token === 'string') {
      return { ok: true, token: raw.body.token };
    }
    return failure(raw, VERIFY_ERRORS, { 401: 'wrong_code', 410: 'expired', 423: 'locked' }, 'server');
  },

  async tangoStart(form: FormData): Promise<{ ok: true; id: string } | Fail<TangoStartError>> {
    const raw = await postForm('/api/tango/start', form);
    if (raw.status === 200 && raw.body?.ok === true && typeof raw.body.id === 'string') {
      return { ok: true, id: raw.body.id };
    }
    return failure(raw, TANGO_START_ERRORS, { 400: 'invalid', 401: 'bad_token', 429: 'rate_limited' }, 'server');
  },

  /** Never throws. Any hiccup reads as "still running" so polling just continues. */
  async tangoStatus(id: string): Promise<StatusResult> {
    try {
      const res = await fetch(`/api/tango/status/${encodeURIComponent(id)}`);
      const body = res.ok ? await readBody(res) : null;
      const status = body?.status;
      if (typeof status === 'string' && (STATUSES as readonly string[]).includes(status)) {
        return body as unknown as StatusResult;
      }
    } catch {
      // fall through
    }
    return { status: 'running' };
  },

  async waitlist(
    token: string,
    kind: 'hd' | 'mug',
    generationId: string,
  ): Promise<{ ok: true } | Fail<'bad_token' | 'server'>> {
    const raw = await postJson('/api/waitlist', { token, kind, generationId });
    if (raw.status === 200 && raw.body?.ok === true) return { ok: true };
    return failure(raw, ['bad_token', 'server'] as const, { 401: 'bad_token' }, 'server');
  },

  async galleryOptin(token: string, id: string): Promise<{ ok: true } | Fail<'bad_token' | 'invalid' | 'server'>> {
    if (!ID_RE.test(id)) return { ok: false, error: 'invalid' };
    const raw = await postJson('/api/gallery/optin', { token, id });
    if (raw.status === 200 && raw.body?.ok === true) return { ok: true };
    return failure(raw, ['bad_token', 'invalid', 'server'] as const, { 400: 'invalid', 401: 'bad_token' }, 'server');
  },
};
