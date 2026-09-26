import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { jsonResponse } from '../http.js';
import { syncMarketData } from '../sync/syncTransactions.js';

const handler = async (_request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
  try {
    const results = await syncMarketData('manual', context);
    const failed = results.filter((result) => result.status === 'failed');
    const succeeded = results.filter((result) => result.status === 'succeeded');
    return jsonResponse(failed.length ? (succeeded.length ? 207 : 502) : 200, { results });
  } catch {
    return jsonResponse(502, { error: 'The DLD market data synchronization failed. Existing data remains available.' });
  }
};

app.http('runMarketDataSync', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'operations/market-data/sync',
  handler,
});
