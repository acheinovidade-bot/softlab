const databaseName = 'erp-sales-force-offline';
const version = 1;
const cacheStore = 'cache';
const queueStore = 'queue';
const mapStore = 'customer-map';

export type OfflineSalesOperation = {
  id: string;
  scope: string;
  kind: 'customer' | 'order';
  body: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  lastError: string | null;
};

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, version);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(cacheStore))
        db.createObjectStore(cacheStore, { keyPath: 'key' });
      if (!db.objectStoreNames.contains(queueStore))
        db.createObjectStore(queueStore, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(mapStore))
        db.createObjectStore(mapStore, { keyPath: 'localId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Falha no armazenamento offline'));
  });
}

function transaction<T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore, done: (result: T) => void) => void,
): Promise<T> {
  return database().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        let result: T;
        action(store, (value) => {
          result = value;
        });
        tx.oncomplete = () => {
          db.close();
          resolve(result);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error('Falha na operação offline'));
        };
      }),
  );
}

export async function cacheSalesForce<T>(scope: string, key: string, data: T) {
  if (typeof indexedDB === 'undefined') return;
  await transaction<void>(cacheStore, 'readwrite', (store, done) => {
    store.put({ key: `${scope}:${key}`, data, cachedAt: new Date().toISOString() });
    done();
  });
}

export async function readSalesForceCache<T>(scope: string, key: string): Promise<T | null> {
  if (typeof indexedDB === 'undefined') return null;
  return transaction<T | null>(cacheStore, 'readonly', (store, done) => {
    const request = store.get(`${scope}:${key}`);
    request.onsuccess = () => done((request.result as { data?: T } | undefined)?.data ?? null);
  });
}

export async function enqueueSalesOperation(operation: OfflineSalesOperation) {
  await transaction<void>(queueStore, 'readwrite', (store, done) => {
    store.put(operation);
    done();
  });
  window.dispatchEvent(new Event('erp:sales-force-queue'));
}

async function operations(scope: string) {
  return transaction<OfflineSalesOperation[]>(queueStore, 'readonly', (store, done) => {
    const request = store.getAll();
    request.onsuccess = () =>
      done(
        (request.result as OfflineSalesOperation[])
          .filter((item) => item.scope === scope)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      );
  });
}

export async function pendingSalesOperations(scope: string) {
  return typeof indexedDB === 'undefined' ? 0 : (await operations(scope)).length;
}

export async function synchronizeSalesOperations(
  scope: string,
  send: (
    operation: OfflineSalesOperation,
    customerId: string | null,
  ) => Promise<{ serverId?: string }>,
) {
  if (typeof indexedDB === 'undefined') return { synced: 0, pending: 0 };
  let synced = 0;
  for (const operation of await operations(scope)) {
    try {
      let customerId =
        typeof operation.body.customerId === 'string' ? operation.body.customerId : null;
      if (customerId?.startsWith('local-'))
        customerId = await transaction<string | null>(mapStore, 'readonly', (store, done) => {
          const request = store.get(customerId!);
          request.onsuccess = () =>
            done((request.result as { serverId?: string } | undefined)?.serverId ?? null);
        });
      if (operation.kind === 'order' && !customerId) break;
      const result = await send(operation, customerId);
      if (
        operation.kind === 'customer' &&
        typeof operation.body.localId === 'string' &&
        result.serverId
      )
        await transaction<void>(mapStore, 'readwrite', (store, done) => {
          store.put({ localId: operation.body.localId, serverId: result.serverId });
          done();
        });
      await transaction<void>(queueStore, 'readwrite', (store, done) => {
        store.delete(operation.id);
        done();
      });
      synced += 1;
    } catch (reason) {
      await transaction<void>(queueStore, 'readwrite', (store, done) => {
        store.put({
          ...operation,
          attempts: operation.attempts + 1,
          lastError: reason instanceof Error ? reason.message : 'Falha ao sincronizar',
        });
        done();
      });
      if (!navigator.onLine) break;
    }
  }
  return { synced, pending: await pendingSalesOperations(scope) };
}

export function networkFailure(reason: unknown) {
  return (
    reason instanceof TypeError ||
    (reason instanceof Error && /fetch|network|comunicação|offline/i.test(reason.message))
  );
}
