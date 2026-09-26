import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { getSqlPool } from '../database.js';
import { jsonResponse, optionsResponse } from '../http.js';

const handler = async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
  if (request.method === 'OPTIONS') return optionsResponse();
  try {
    const pool = await getSqlPool();
    const [runs, counts] = await Promise.all([
      pool.request().query(`WITH ranked AS (SELECT *, ROW_NUMBER() OVER(PARTITION BY dataset ORDER BY completed_at DESC) AS rn
        FROM market_ingest.sync_runs WHERE status IN ('succeeded','failed')) SELECT * FROM ranked WHERE rn=1`),
      pool.request().query(`SELECT 'transactions' dataset, COUNT_BIG(*) row_count FROM market_ingest.current_transactions
        UNION ALL SELECT 'projects', COUNT_BIG(*) FROM market_ingest.projects
        UNION ALL SELECT 'valuations', COUNT_BIG(*) FROM market_ingest.current_valuations`),
    ]);
    const countByDataset = Object.fromEntries(counts.recordset.map((row) => [row.dataset, Number(row.row_count)]));
    const present = (row: Record<string, unknown>) => ({ runId: String(row.id), dataset: row.dataset, trigger: row.trigger_type,
      status: row.status, requestedFrom: row.requested_from, requestedTo: row.requested_to, startedAt: row.started_at,
      completedAt: row.completed_at, rowCount: row.row_count, uniqueRecordCount: row.unique_record_count,
      observedMinAt: row.observed_min_at, observedMaxAt: row.observed_max_at, error: row.status === 'failed' ? row.error_message : undefined });
    const datasets = Object.fromEntries(runs.recordset.map((row) => [row.dataset, { rowCount: countByDataset[row.dataset] ?? 0, latestRun: present(row) }]));
    const transactionRun = runs.recordset.find((row) => row.dataset === 'transactions' && row.status === 'succeeded') ?? runs.recordset.find((row) => row.dataset === 'transactions');
    const newest = runs.recordset.reduce((value, row) => !value || new Date(row.completed_at) > new Date(value.completed_at) ? row : value, null);
    const staleAfterHours = 108; const completedAt = newest?.completed_at ? new Date(newest.completed_at) : null;
    return jsonResponse(200, { available: Object.values(countByDataset).some((count) => Number(count) > 0), stale: !completedAt || Date.now() - completedAt.getTime() > staleAfterHours * 3_600_000,
      staleAfterHours, datasets, lastSync: transactionRun ? present(transactionRun) : null }, { 'cache-control': 'public, max-age=60' });
  } catch (error) { context.error(error); return jsonResponse(500, { error: 'Unable to read synchronization status.' }); }
};
app.http('getSyncStatus', { methods: ['GET', 'OPTIONS'], authLevel: 'anonymous', route: 'market-data/status', handler });
