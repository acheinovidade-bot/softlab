const databaseName = 'erp-hibrido-offline';
const version = 1;
const queueStore = 'pos-checkouts';
const lookupStore = 'pos-lookups';

export interface OfflineCheckout {
  id: string;
  scope: string;
  body: unknown;
  total: number;
  itemCount: number;
  createdAt: string;
  attempts: number;
  lastError: string | null;
}

function database(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined')
    return Promise.reject(new Error('Armazenamento offline indisponível'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, version);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(queueStore))
        db.createObjectStore(queueStore, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(lookupStore))
        db.createObjectStore(lookupStore, { keyPath: 'scope' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('Falha ao abrir armazenamento offline'));
  });
}
function transaction<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore, done: (value: T) => void) => void,
): Promise<T> {
  return database().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        let result: T;
        operation(store, (value) => {
          result = value;
        });
        tx.oncomplete = () => {
          db.close();
          resolve(result);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error('Falha na transação offline'));
        };
      }),
  );
}
export async function cachePosLookups<T>(scope: string, data: T) {
  if (typeof indexedDB === 'undefined') return;
  await transaction<void>(lookupStore, 'readwrite', (store, done) => {
    store.put({ scope, data, cachedAt: new Date().toISOString() });
    done();
  });
}
export async function readPosLookups<T>(scope: string): Promise<T | null> {
  if (typeof indexedDB === 'undefined') return null;
  return transaction<T | null>(lookupStore, 'readonly', (store, done) => {
    const request = store.get(scope);
    request.onsuccess = () => {
      const result = request.result as { data?: T } | undefined;
      done(result?.data ?? null);
    };
  });
}
export async function enqueueCheckout(item: OfflineCheckout) {
  await transaction<void>(queueStore, 'readwrite', (store, done) => {
    store.put(item);
    done();
  });
  notify();
}
async function rows(scope: string): Promise<OfflineCheckout[]> {
  if (typeof indexedDB === 'undefined') return [];
  return transaction<OfflineCheckout[]>(queueStore, 'readonly', (store, done) => {
    const request = store.getAll();
    request.onsuccess = () =>
      done((request.result as OfflineCheckout[]).filter((item) => item.scope === scope));
  });
}
export async function pendingCheckoutCount(scope: string) {
  return typeof indexedDB === 'undefined' ? 0 : (await rows(scope)).length;
}
export async function synchronizeCheckouts(
  scope: string,
  send: (body: unknown) => Promise<unknown>,
) {
  const pending = (await rows(scope)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let synced = 0;
  for (const item of pending) {
    try {
      await send(item.body);
      await transaction<void>(queueStore, 'readwrite', (store, done) => {
        store.delete(item.id);
        done();
      });
      synced += 1;
    } catch (reason) {
      await transaction<void>(queueStore, 'readwrite', (store, done) => {
        store.put({
          ...item,
          attempts: item.attempts + 1,
          lastError: reason instanceof Error ? reason.message : 'Falha ao sincronizar',
        });
        done();
      });
      if (!navigator.onLine || isNetworkFailure(reason)) break;
    }
  }
  return { synced, pending: await pendingCheckoutCount(scope) };
}
export function isNetworkFailure(reason: unknown) {
  return (
    reason instanceof TypeError ||
    (reason instanceof Error && /fetch|network|comunicação|offline/i.test(reason.message))
  );
}
function notify() {
  window.dispatchEvent(new Event('erp:offline-queue'));
}
