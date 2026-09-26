import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'csv-parse/sync';
import sql from 'mssql';
import { parseDldCsv } from '../src/dld/parser.js';
import { parseDldProjects, parseDldValuations } from '../src/dld/referenceData.js';
import { ingestProjects, ingestRows, ingestValuations } from '../src/sync/ingestRows.js';
import { createSqlPool } from './sqlConnection.js';

const readCsvRecords = async (path: string): Promise<{ body: Buffer; records: Record<string, string>[] }> => {
  const body = await readFile(path);
  const records = parse(body, { bom: true, columns: (headers: string[]) => headers.map((header) => header.trim()), skip_empty_lines: true, trim: true, relax_quotes: true, relax_column_count: true, skip_records_with_error: true }) as Record<string, string>[];
  return { body, records };
};

const transactionFile = resolve(process.argv[2] || '../source-data/transactions-2026-08-17.csv');
const projectFile = resolve(process.argv[3] || '../files/projects-2026-08-26.csv');
const valuationFile = resolve(process.argv[4] || '../source-data/valuations-2026-08-17.csv');
const transactionBody = await readFile(transactionFile); const transactionRows = parseDldCsv(transactionBody);
const projectSource = await readCsvRecords(projectFile); const projectRows = parseDldProjects({ responseCode: 200, response: { result: projectSource.records } });
const valuationSource = await readCsvRecords(valuationFile); const valuationRows = parseDldValuations({ responseCode: 200, response: { result: valuationSource.records } });
const pool = await createSqlPool();

const seed = async (dataset: 'transactions' | 'projects' | 'valuations', body: Buffer, rows: unknown[], min: Date, max: Date, ingest: (transaction: sql.Transaction, runId: number) => Promise<void>, unique: number) => {
  const transaction = new sql.Transaction(pool); await transaction.begin();
  try {
    const run = await new sql.Request(transaction).input('dataset', sql.VarChar(20), dataset).input('from', sql.Date, min).input('to', sql.Date, max)
      .input('bytes', sql.BigInt, body.byteLength).input('hash', sql.Char(64), createHash('sha256').update(body).digest('hex'))
      .input('rows', sql.Int, rows.length).input('unique', sql.Int, unique).input('minAt', sql.DateTime2(3), min).input('maxAt', sql.DateTime2(3), max)
      .query<{ id: number }>(`INSERT INTO market_ingest.sync_runs(dataset,trigger_type,status,requested_from,requested_to,source_bytes,source_sha256,row_count,unique_record_count,observed_min_at,observed_max_at,completed_at)
        OUTPUT INSERTED.id VALUES(@dataset,'seed','succeeded',@from,@to,@bytes,@hash,@rows,@unique,@minAt,@maxAt,SYSUTCDATETIME())`);
    await ingest(transaction, run.recordset[0].id); await transaction.commit();
    process.stdout.write(`Seeded ${rows.length} ${dataset} rows.\n`);
  } catch (error) { await transaction.rollback(); throw error; }
};

try {
  const txMin = transactionRows.reduce((a, row) => row.instanceAt < a ? row.instanceAt : a, transactionRows[0].instanceAt);
  const txMax = transactionRows.reduce((a, row) => row.instanceAt > a ? row.instanceAt : a, transactionRows[0].instanceAt);
  await seed('transactions', transactionBody, transactionRows, txMin, txMax, (tx, id) => ingestRows(tx, id, transactionRows), new Set(transactionRows.map((row) => row.transactionNumber)).size);
  const now = new Date(); const projectMin = new Date(now); projectMin.setUTCDate(projectMin.getUTCDate() - 366);
  await seed('projects', projectSource.body, projectRows, projectMin, now, (tx, id) => ingestProjects(tx, id, projectRows), new Set(projectRows.map((row) => row.projectNumber)).size);
  const valMin = valuationRows.reduce((a, row) => row.instanceAt < a ? row.instanceAt : a, valuationRows[0].instanceAt);
  const valMax = valuationRows.reduce((a, row) => row.instanceAt > a ? row.instanceAt : a, valuationRows[0].instanceAt);
  await seed('valuations', valuationSource.body, valuationRows, valMin, valMax, (tx, id) => ingestValuations(tx, id, valuationRows), new Set(valuationRows.map((row) => `${row.procedureYear}:${row.procedureNumber}`)).size);
} finally { await pool.close(); }
