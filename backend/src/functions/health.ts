import { app, type HttpRequest, type HttpResponseInit } from '@azure/functions';
import { withSqlRetry } from '../database.js';
import { jsonResponse, optionsResponse } from '../http.js';

const handler = async (request: HttpRequest): Promise<HttpResponseInit> => {
  if (request.method === 'OPTIONS') return optionsResponse();
  try {
    await withSqlRetry((pool) => pool.request().query('select 1'));
    return jsonResponse(200, { status: 'healthy' }, { 'cache-control': 'no-store' });
  } catch {
    return jsonResponse(503, { status: 'unavailable' }, { 'cache-control': 'no-store' });
  }
};

app.http('health', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'health',
  handler,
});
