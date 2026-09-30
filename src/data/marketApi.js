const configuredBaseUrl = (import.meta.env.VITE_MARKET_API_URL || '').trim().replace(/\/$/, '');
const CACHE_DATABASE = 'dubai-market-lens'; const CACHE_STORE = 'api-snapshots'; const CACHE_KEY = 'market-data-v2';
const defaultDateRange = () => { const to = new Date(); const from = new Date(to); from.setUTCDate(from.getUTCDate() - 366); return { from: import.meta.env.VITE_MARKET_API_FROM_DATE || from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }; };
const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, { ...options, headers: { accept: 'application/json', ...options.headers } });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error || `Market API request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return payload;
};
const openCache = () => new Promise((resolve, reject) => { if (!globalThis.indexedDB) return resolve(null); const request = globalThis.indexedDB.open(CACHE_DATABASE, 1); request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(CACHE_STORE)) request.result.createObjectStore(CACHE_STORE); }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
const readCache = async () => { const database = await openCache(); if (!database) return null; try { return await new Promise((resolve, reject) => { const request = database.transaction(CACHE_STORE, 'readonly').objectStore(CACHE_STORE).get(CACHE_KEY); request.onsuccess = () => resolve(request.result ?? null); request.onerror = () => reject(request.error); }); } finally { database.close(); } };
const writeCache = async (snapshot) => { const database = await openCache(); if (!database) return; try { await new Promise((resolve, reject) => { const request = database.transaction(CACHE_STORE, 'readwrite').objectStore(CACHE_STORE).put(snapshot, CACHE_KEY); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); }); } finally { database.close(); } };

const loadPages = async (route) => {
  const { from, to } = defaultDateRange(); const items = []; const seen = new Set(); let cursor = null;
  do {
    if (cursor && seen.has(cursor)) throw new Error(`Market API repeated a ${route} pagination cursor.`);
    if (cursor) seen.add(cursor); if (seen.size > 100) throw new Error(`Market API ${route} pagination exceeded 100 pages.`);
    const url = new URL(`${configuredBaseUrl}/${route}`, globalThis.location.href); url.searchParams.set('from', from); url.searchParams.set('to', to); url.searchParams.set('limit', '20000'); if (cursor) url.searchParams.set('cursor', cursor);
    const page = await fetchJson(url); if (!Array.isArray(page.items)) throw new Error(`Market API returned an invalid ${route} page.`); items.push(...page.items); cursor = page.nextCursor || null;
  } while (cursor);
  return items;
};

export const loadApiMarketData = async () => {
  if (!configuredBaseUrl) return null;
  try {
    const [transactions, valuations, projectPage, syncStatus] = await Promise.all([
      loadPages('transactions'), loadPages('valuations'), fetchJson(`${configuredBaseUrl}/projects`), fetchJson(`${configuredBaseUrl}/market-data/status`).catch(() => null),
    ]);
    if (!Array.isArray(projectPage.items)) throw new Error('Market API returned an invalid projects page.');
    const snapshot = { transactions, valuations, projects: projectPage.items, syncStatus, savedAt: new Date().toISOString() };
    await writeCache(snapshot).catch(() => {}); return snapshot;
  } catch (error) {
    const cached = await readCache().catch(() => null);
    if (cached?.transactions?.length && cached?.valuations?.length && cached?.projects?.length) return { ...cached, fromCache: true, cacheError: error };
    throw error;
  }
};

export const reviewApiTransaction = async ({ transactionNumber, decision, accessToken }) => {
  if (!configuredBaseUrl) throw new Error('The market API is not configured.');
  if (!accessToken) throw new Error('Sign in with an authorized Google account to review transactions.');
  return fetchJson(`${configuredBaseUrl}/operations/transactions/review`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ transactionNumber, decision }),
  });
};

export const updateCachedTransactionReview = async ({ transactionNumber, decision, restoreRows = [] }) => {
  const cached = await readCache().catch(() => null);
  if (!cached?.transactions) return;
  let transactions;
  if (decision === 'disliked') {
    transactions = cached.transactions.filter((row) => row.transactionNumber !== transactionNumber);
  } else if (restoreRows.length) {
    transactions = [
      ...cached.transactions.filter((row) => row.transactionNumber !== transactionNumber),
      ...restoreRows.map((row) => ({ ...row, reviewDecision: decision === 'liked' ? 'liked' : null })),
    ];
  } else {
    transactions = cached.transactions.map((row) => row.transactionNumber === transactionNumber
      ? { ...row, reviewDecision: decision === 'liked' ? 'liked' : null }
      : row);
  }
  await writeCache({ ...cached, transactions });
};
