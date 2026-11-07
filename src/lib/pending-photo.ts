/**
 * Hand-off of a photo picked on the home page ("+ Your cat") to /tango-me.
 * Stored in IndexedDB because a File survives structured cloning there (sessionStorage cannot hold blobs).
 */
export const PENDING_KEY = 'ttw.pendingPhoto';
export const PENDING_TTL_MS = 60 * 60 * 1000;
const DB_NAME = 'ttw';
const STORE = 'kv';

export interface KV {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
}

interface Stored {
  blob: Blob;
  name: string;
  type: string;
  savedAt: number;
}

const req = <T>(r: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

/** Minimal key/value store on top of IndexedDB. */
export function idbKV(factory: IDBFactory = indexedDB): KV {
  let dbp: Promise<IDBDatabase> | null = null;
  const db = () => {
    if (!dbp) {
      const open = factory.open(DB_NAME, 1);
      open.onupgradeneeded = () => {
        if (!open.result.objectStoreNames.contains(STORE)) open.result.createObjectStore(STORE);
      };
      dbp = req(open);
    }
    return dbp;
  };
  const tx = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) => {
    const d = await db();
    return req(fn(d.transaction(STORE, mode).objectStore(STORE)));
  };
  return {
    get: (k) => tx('readonly', (s) => s.get(k)),
    set: async (k, v) => void (await tx('readwrite', (s) => s.put(v, k))),
    del: async (k) => void (await tx('readwrite', (s) => s.delete(k))),
  };
}

export async function stashPhoto(kv: KV, file: File, now = Date.now()): Promise<boolean> {
  try {
    const v: Stored = { blob: file, name: file.name, type: file.type, savedAt: now };
    await kv.set(PENDING_KEY, v);
    return true;
  } catch {
    return false;
  }
}

/** Read and clear the pending photo. Stale (> 1 h) or malformed entries are dropped. */
export async function takePendingPhoto(kv: KV, now = Date.now()): Promise<File | null> {
  let v: unknown;
  try {
    v = await kv.get(PENDING_KEY);
  } catch {
    return null;
  }
  if (v === undefined || v === null) return null;
  try {
    await kv.del(PENDING_KEY);
  } catch {
    /* best effort */
  }
  const s = v as Partial<Stored>;
  if (!(s.blob instanceof Blob) || typeof s.name !== 'string' || typeof s.savedAt !== 'number') return null;
  if (now - s.savedAt > PENDING_TTL_MS || s.savedAt > now + 60_000) return null;
  return new File([s.blob], s.name, { type: s.type || s.blob.type });
}
