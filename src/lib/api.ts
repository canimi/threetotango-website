import { isValidCode } from './validate';

export type Source = 'gift' | 'tango-me' | 'footer';
export type SubscribeError = 'invalid_email' | 'rate_limited' | 'server';
export type VerifyError = 'wrong_code' | 'expired' | 'locked' | 'server';

type Fail<E extends string> = { ok: false; error: E };
type Raw = { status: number; body: Record<string, unknown> | null };

/** Shared by every endpoint. Never throws; network/parse failures yield body=null, status=0/actual. */
async function postJson(path: string, payload: unknown): Promise<Raw> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    let body: Record<string, unknown> | null = null;
    try {
      const parsed: unknown = await res.json();
      if (parsed && typeof parsed === 'object') body = parsed as Record<string, unknown>;
    } catch {
      body = null;
    }
    return { status: res.status, body };
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
};
