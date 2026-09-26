import { createHash } from 'node:crypto';
import type { InvocationContext, Timer } from '@azure/functions';
import { getRuntimeConfig } from '../config.js';
import { getSqlPool, sql } from '../database.js';
import { buildDldPayload, DLD_EXPORT_URL } from '../dld/contract.js';
import { parseDldCsv, type ParsedDldRow } from '../dld/parser.js';
import { buildProjectsPayload, buildValuationsPayload, DLD_PROJECTS_URL, DLD_VALUATIONS_URL, parseDldProjects, parseDldValuations } from '../dld/referenceData.js';
import { ingestProjects, ingestRows, ingestValuations } from './ingestRows.js';

export type SyncTrigger = 'scheduled' | 'manual';
export type Dataset = 'transactions' | 'projects' | 'valuations';
export interface SyncResult { dataset: Dataset; status: 'succeeded' | 'failed' | 'skipped'; runId?: number; rowCount?: number; requestedFrom?: string; requestedTo?: string; reason?: string }

const dateOnly = (date: Date): string => date.toISOString().slice(0, 10);
const subtractDays = (date: Date, days: number): Date => { const value = new Date(date); value.setUTCDate(value.getUTCDate() - days); return value; };
const referenceWindow = () => { const to = new Date(); return { from: subtractDays(to, 366), to }; };

const transactionWindow = async (transaction: sql.Transaction) => {
  const latest = await new sql.Request(transaction).query<{ observed_max_at: Date | null }>(`
    SELECT TOP (1) observed_max_at FROM market_ingest.sync_runs
    WHERE dataset = 'transactions' AND status = 'succeeded' AND observed_max_at IS NOT NULL
    ORDER BY completed_at DESC`);
  const to = new Date();
  const observed = latest.recordset[0]?.observed_max_at ?? subtractDays(to, 7);
  return { from: subtractDays(new Date(observed), getRuntimeConfig().overlapDays), to };
};

const acquireLock = async (transaction: sql.Transaction, dataset: Dataset): Promise<boolean> => {
  const result = await new sql.Request(transaction).input('resource', sql.NVarChar(255), `market_ingest.${dataset}`)
    .query<{ result: number }>(`DECLARE @result int;
      EXEC @result = sys.sp_getapplock @Resource=@resource, @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=0;
      SELECT @result AS result;`);
  return (result.recordset[0]?.result ?? -1) >= 0;
};

const recentSyncExists = async (transaction: sql.Transaction, dataset: Dataset): Promise<boolean> => {
  const result = await new sql.Request(transaction).input('minutes', sql.Int, getRuntimeConfig().manualSyncCooldownMinutes)
    .input('dataset', sql.VarChar(20), dataset)
    .query(`SELECT TOP (1) 1 AS found FROM market_ingest.sync_runs
      WHERE dataset=@dataset AND trigger_type IN ('manual','scheduled') AND status IN ('running','succeeded')
        AND started_at > DATEADD(minute, -@minutes, SYSUTCDATETIME())`);
  return result.recordset.length > 0;
};

const createRun = async (transaction: sql.Transaction, dataset: Dataset, trigger: SyncTrigger, from: Date, to: Date): Promise<number> => {
  const result = await new sql.Request(transaction).input('dataset', sql.VarChar(20), dataset)
    .input('trigger', sql.VarChar(20), trigger).input('from', sql.Date, dateOnly(from)).input('to', sql.Date, dateOnly(to))
    .query<{ id: number }>(`INSERT INTO market_ingest.sync_runs(dataset,trigger_type,status,requested_from,requested_to)
      OUTPUT INSERTED.id VALUES(@dataset,@trigger,'running',@from,@to)`);
  return result.recordset[0].id;
};

const recordFailure = async (dataset: Dataset, trigger: SyncTrigger, from: Date, to: Date, message: string): Promise<void> => {
  const pool = await getSqlPool();
  await pool.request().input('dataset', sql.VarChar(20), dataset).input('trigger', sql.VarChar(20), trigger)
    .input('from', sql.Date, dateOnly(from)).input('to', sql.Date, dateOnly(to))
    .input('message', sql.NVarChar(1000), message.slice(0, 1000)).query(`
      INSERT INTO market_ingest.sync_runs(dataset,trigger_type,status,requested_from,requested_to,completed_at,error_code,error_message)
      VALUES(@dataset,@trigger,'failed',@from,@to,SYSUTCDATETIME(),'DLD_SYNC_FAILED',@message)`);
};

const fetchBody = async (url: string, payload: unknown, accept: string) => {
  const config = getRuntimeConfig(); const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', accept }, body: JSON.stringify(payload), signal: controller.signal });
    if (!response.ok) throw new Error(`DLD ${url.split('/').at(-1)} returned HTTP ${response.status}`);
    const declared = Number(response.headers.get('content-length') || 0);
    if (declared > config.maximumCsvBytes) throw new Error('DLD response exceeds the configured byte limit');
    const body = Buffer.from(await response.arrayBuffer());
    if (body.byteLength > config.maximumCsvBytes) throw new Error('DLD response exceeds the configured byte limit');
    return { body, status: response.status };
  } finally { clearTimeout(timeout); }
};

const observedRange = (rows: ParsedDldRow[]): { min: Date | null; max: Date | null } => rows.length
  ? rows.reduce((range, row) => ({ min: row.instanceAt < range.min ? row.instanceAt : range.min, max: row.instanceAt > range.max ? row.instanceAt : range.max }), { min: rows[0].instanceAt, max: rows[0].instanceAt })
  : { min: null, max: null };

const completeRun = async (transaction: sql.Transaction, runId: number, response: { body: Buffer; status: number }, rowCount: number, uniqueCount: number, min: Date | null, max: Date | null) => {
  await new sql.Request(transaction).input('runId', sql.BigInt, runId).input('httpStatus', sql.Int, response.status)
    .input('bytes', sql.BigInt, response.body.byteLength).input('hash', sql.Char(64), createHash('sha256').update(response.body).digest('hex'))
    .input('rows', sql.Int, rowCount).input('unique', sql.Int, uniqueCount).input('min', sql.DateTime2(3), min).input('max', sql.DateTime2(3), max)
    .query(`UPDATE market_ingest.sync_runs SET status='succeeded',completed_at=SYSUTCDATETIME(),source_http_status=@httpStatus,
      source_bytes=@bytes,source_sha256=@hash,row_count=@rows,unique_record_count=@unique,observed_min_at=@min,observed_max_at=@max WHERE id=@runId`);
};

const runDataset = async (dataset: Dataset, trigger: SyncTrigger, context?: InvocationContext): Promise<SyncResult> => {
  const pool = await getSqlPool(); const transaction = new sql.Transaction(pool); let window = referenceWindow();
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
    if (!await acquireLock(transaction, dataset)) { await transaction.rollback(); return { dataset, status: 'skipped', reason: `A ${dataset} sync is already running.` }; }
    if (trigger === 'manual' && await recentSyncExists(transaction, dataset)) { await transaction.rollback(); return { dataset, status: 'skipped', reason: `A ${dataset} sync ran recently.` }; }
    if (dataset === 'transactions') window = await transactionWindow(transaction);
    const runId = await createRun(transaction, dataset, trigger, window.from, window.to);
    const config = getRuntimeConfig(); let response: { body: Buffer; status: number }; let rowCount = 0; let uniqueCount = 0; let min: Date | null = null; let max: Date | null = null;
    if (dataset === 'transactions') {
      response = await fetchBody(DLD_EXPORT_URL, buildDldPayload(window.from, window.to), 'text/csv');
      const rows = parseDldCsv(response.body, config.maximumRows); const range = observedRange(rows); min = range.min; max = range.max;
      rowCount = rows.length; uniqueCount = new Set(rows.map((row) => row.transactionNumber)).size; await ingestRows(transaction, runId, rows);
    } else if (dataset === 'projects') {
      response = await fetchBody(DLD_PROJECTS_URL, buildProjectsPayload(window.from, window.to), 'application/json');
      const rows = parseDldProjects(JSON.parse(response.body.toString('utf8')), config.maximumRows);
      rowCount = rows.length; uniqueCount = new Set(rows.map((row) => row.projectNumber)).size; await ingestProjects(transaction, runId, rows);
    } else {
      response = await fetchBody(DLD_VALUATIONS_URL, buildValuationsPayload(window.from, window.to), 'application/json');
      const rows = parseDldValuations(JSON.parse(response.body.toString('utf8')), config.maximumRows);
      rowCount = rows.length; uniqueCount = new Set(rows.map((row) => `${row.procedureYear}:${row.procedureNumber}`)).size;
      if (rows.length) { min = rows.reduce((a, row) => row.instanceAt < a ? row.instanceAt : a, rows[0].instanceAt); max = rows.reduce((a, row) => row.instanceAt > a ? row.instanceAt : a, rows[0].instanceAt); }
      await ingestValuations(transaction, runId, rows);
    }
    await completeRun(transaction, runId, response, rowCount, uniqueCount, min, max); await transaction.commit();
    context?.log(`DLD ${dataset} sync ${runId} stored ${rowCount} rows.`);
    return { dataset, status: 'succeeded', runId, rowCount, requestedFrom: dateOnly(window.from), requestedTo: dateOnly(window.to) };
  } catch (error) {
    await transaction.rollback().catch(() => {}); const message = error instanceof Error ? error.message : 'Unknown sync failure';
    await recordFailure(dataset, trigger, window.from, window.to, message).catch((failure) => context?.error(failure));
    context?.error(`DLD ${dataset} sync failed: ${message}`); return { dataset, status: 'failed', reason: message };
  }
};

export const syncMarketData = async (trigger: SyncTrigger, context?: InvocationContext): Promise<SyncResult[]> => {
  const results: SyncResult[] = [];
  for (const dataset of ['transactions', 'projects', 'valuations'] as const) results.push(await runDataset(dataset, trigger, context));
  return results;
};

export const scheduledSyncHandler = async (_timer: Timer, context: InvocationContext): Promise<void> => {
  const results = await syncMarketData('scheduled', context);
  if (results.some((result) => result.status === 'failed')) context.warn('One or more DLD datasets failed; existing data remains available.');
};
