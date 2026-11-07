import type { StatusResult, TangoStartError } from './api';

export type { StatusResult };
export type StartResult = { ok: true; id: string } | { ok: false; error: TangoStartError };

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const OK_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];

export const PERSONALITIES = ['genius', 'chatterbox', 'unbothered', 'chaos'] as const;
export const SCENES = [
  'kitchen-table',
  'sofa-gang',
  'fridge-heist',
  'box-fort',
  'window-birds',
  'lettuce-crime',
  'custom',
] as const;

export function validateUpload(f: { type: string; size: number; name: string }): 'ok' | 'type' | 'size' {
  const heicByName = f.type === '' && /\.(heic|heif)$/i.test(f.name);
  if (!OK_TYPES.includes(f.type.toLowerCase()) && !heicByName) return 'type';
  if (f.size > MAX_UPLOAD_BYTES) return 'size';
  return 'ok';
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Polls until done/failed. Rejects with 'timeout' once timeoutMs has passed. */
export async function pollStatus(
  id: string,
  opts: { intervalMs: number; timeoutMs: number; status: (id: string) => Promise<StatusResult> },
): Promise<StatusResult> {
  const deadline = Date.now() + opts.timeoutMs;
  for (;;) {
    const r = await opts.status(id);
    if (r.status === 'done' || r.status === 'failed') return r;
    if (Date.now() + opts.intervalMs > deadline) throw 'timeout';
    await sleep(opts.intervalMs);
  }
}

// ---- localStorage helpers: every access is guarded, privacy modes may throw ----
const ACTIVE_KEY = 'ttw.tango.active';
const TOKEN_KEY = 'ttw.token';
export const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export function saveActive(id: string): void {
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    // ignore
  }
}
export function loadActive(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}
export function clearActive(): void {
  try {
    localStorage.removeItem(ACTIVE_KEY);
  } catch {
    // ignore
  }
}

export function saveToken(token: string, now = Date.now()): void {
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, exp: now + TOKEN_TTL_MS }));
  } catch {
    // ignore
  }
}
export function loadToken(now = Date.now()): string | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const v: unknown = JSON.parse(raw);
    if (v && typeof v === 'object') {
      const { token, exp } = v as { token?: unknown; exp?: unknown };
      if (typeof token === 'string' && typeof exp === 'number' && exp >= now) return token;
    }
  } catch {
    // corrupt or unavailable
  }
  return null;
}

/**
 * Double-submit guard. While a call is in flight, further calls return the same promise.
 * One idemKey per form session is appended to the FormData and reused on retry until reset().
 */
export function createSubmitter(start: (fd: FormData) => Promise<StartResult>) {
  let pending: Promise<StartResult> | null = null;
  let idemKey: string | null = null;
  const submit = (fd: FormData): Promise<StartResult> => {
    if (pending) return pending;
    idemKey ??= crypto.randomUUID();
    fd.set('idemKey', idemKey);
    const p = start(fd).finally(() => {
      pending = null;
    });
    pending = p;
    return p;
  };
  submit.submit = submit;
  submit.reset = () => {
    idemKey = null;
  };
  return submit;
}
