/**
 * IndexedDB SWR cache. Only a small, explicitly approved set of read-only
 * queries is persisted. Never store tokens, messages, admin data or auth.
 * Each account receives its own namespace; logout removes local data.
 */
const DB_NAME = 'collegebook-v415-cache';
const STORE = 'snapshots';
const MAX_AGE = 24 * 60 * 60 * 1000;
const ALLOWED = new Set(['feed', 'news-feeds', 'birthdays', 'institution-news']);
let activeUser = null;
let currentDatabase = null;

function openDatabase() {
  if (!('indexedDB' in window)) return Promise.resolve(null);
  if (!currentDatabase) {
    currentDatabase = new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
  }
  return currentDatabase;
}

async function transact(mode, callback) {
  const database = await openDatabase();
  if (!database) return null;
  return new Promise((resolve) => {
    try {
      const transaction = database.transaction(STORE, mode);
      const request = callback(transaction.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      transaction.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function cacheKey(userId) {
  return `account:${userId}`;
}

export function cacheableQuery(query) {
  return query.state.status === 'success' &&
    ALLOWED.has(query.queryKey[0]) &&
    query.queryKey.length <= 3 &&
    query.state.data !== undefined;
}

export async function restoreOfflineQueries(queryClient, userId) {
  if (!userId) return;
  const restoringUser = String(userId);
  if (activeUser !== restoringUser) {
    queryClient.removeQueries({ predicate: (query) => ALLOWED.has(query.queryKey[0]) });
  }
  activeUser = restoringUser;
  const record = await transact('readonly', (store) => store.get(cacheKey(restoringUser)));
  if (activeUser !== restoringUser) return;
  if (!record || Date.now() - record.savedAt > MAX_AGE) return;

  for (const entry of record.queries || []) {
    if (!Array.isArray(entry.queryKey) || !ALLOWED.has(entry.queryKey[0]) || entry.queryKey.length > 3) continue;
    const existing = queryClient.getQueryState(entry.queryKey);
    if (!existing || existing.dataUpdatedAt < entry.updatedAt) {
      queryClient.setQueryData(entry.queryKey, entry.data, { updatedAt: entry.updatedAt });
    }
  }
}

export async function persistOfflineQueries(queryClient) {
  if (!activeUser) return;
  const userId = activeUser;
  const queries = queryClient.getQueryCache().getAll()
    .filter(cacheableQuery)
    .map((query) => ({
      queryKey: query.queryKey,
      data: query.state.data,
      updatedAt: query.state.dataUpdatedAt,
    }));
  if (userId !== activeUser) return;
  await transact('readwrite', (store) => store.put({ savedAt: Date.now(), queries }, cacheKey(userId)));
}

export async function clearOfflineQueries(queryClient) {
  const userId = activeUser;
  activeUser = null;
  if (userId) await transact('readwrite', (store) => store.delete(cacheKey(userId)));
  queryClient.removeQueries({ predicate: (query) => ALLOWED.has(query.queryKey[0]) });
}

export function startOfflinePersistence(queryClient) {
  let pending = null;
  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (!activeUser || event.type !== 'updated' || !cacheableQuery(event.query)) return;
    window.clearTimeout(pending);
    pending = window.setTimeout(() => persistOfflineQueries(queryClient), 900);
  });
  return () => {
    unsubscribe();
    window.clearTimeout(pending);
  };
}
