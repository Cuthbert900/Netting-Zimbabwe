// Keeps uploaded extracts in the browser's IndexedDB rather than
// localStorage. localStorage holds roughly 5 MB, so a real month of Prism
// and bank extracts never fit: saving failed and the app fell back to
// keeping 20 rows per file, which silently changed every figure after a
// page reload. IndexedDB holds hundreds of MB and stores the rows as-is.
// Everything stays in this browser, as before.

import type { SourceKey, StoredExtract } from '@/lib/data-sources-context';

type FilesBySource = Record<SourceKey, StoredExtract[]>;

const DB_NAME = 'netting-recon';
const DB_VERSION = 1;
const STORE = 'kv';
const KEY = 'data-sources';
/** Where extracts lived before IndexedDB — read once to migrate, then removed. */
export const LEGACY_LOCALSTORAGE_KEY = 'netting-recon:data-sources:v1';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result as T);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function loadStoredExtracts(): Promise<FilesBySource | null> {
  const fromDb = await withStore<FilesBySource | undefined>('readonly', (s) =>
    s.get(KEY)
  );
  if (fromDb) return fromDb;

  // One-time migration from localStorage. Whatever survived there may have
  // been cut down to 20 rows per file, so files are carried over as they are
  // and the user can re-upload anything that looks short.
  try {
    const raw = window.localStorage.getItem(LEGACY_LOCALSTORAGE_KEY);
    if (!raw) return null;
    const legacy = JSON.parse(raw) as FilesBySource;
    await saveStoredExtracts(legacy);
    window.localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY);
    return legacy;
  } catch {
    return null;
  }
}

export async function saveStoredExtracts(state: FilesBySource): Promise<void> {
  await withStore('readwrite', (s) => s.put(state, KEY));
}

export async function clearStoredExtracts(): Promise<void> {
  await withStore('readwrite', (s) => s.delete(KEY));
  try {
    window.localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY);
  } catch {
    // Best effort.
  }
}
