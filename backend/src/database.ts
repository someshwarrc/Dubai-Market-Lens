import { ManagedIdentityCredential } from '@azure/identity';
import sql from 'mssql';
import { getSqlDatabase, getSqlManagedIdentityClientId, getSqlServer } from './config.js';

const SQL_SCOPE = 'https://database.windows.net/.default';
const SQL_CONNECT_ATTEMPTS = 3;
const SQL_OPERATION_ATTEMPTS = 3;
const SQL_RETRY_DELAYS_MS = [2_000, 5_000];
let poolPromise: Promise<sql.ConnectionPool> | undefined;
let poolExpiresAt = 0;

type SqlError = Error & {
  code?: string;
  number?: number;
  originalError?: unknown;
  cause?: unknown;
};

const wait = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));

const errorChain = (error: unknown): SqlError[] => {
  const errors: SqlError[] = [];
  const seen = new Set<unknown>();
  let current = error;
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    errors.push(current as SqlError);
    current = (current as SqlError).originalError ?? (current as SqlError).cause;
  }
  return errors;
};

export const isTransientSqlError = (error: unknown): boolean => {
  const transientCodes = new Set(['ECONNCLOSED', 'ECONNRESET', 'ENOTOPEN', 'ESOCKET', 'ETIMEOUT']);
  const transientNumbers = new Set([40197, 40501, 40613, 49918, 49919, 49920]);
  return errorChain(error).some((candidate) => {
    if (candidate.code && transientCodes.has(candidate.code.toUpperCase())) return true;
    if (candidate.number && transientNumbers.has(candidate.number)) return true;
    return /database .* is not currently available|connection (?:is closed|not yet open)|temporarily unavailable|timed? out/i.test(candidate.message || '');
  });
};

const errorCategory = (error: unknown): string => {
  const candidate = errorChain(error).find((value) => value.code || value.number);
  return String(candidate?.code ?? candidate?.number ?? 'transient-sql-error');
};

const logSqlEvent = (event: string, details: Record<string, unknown>): void => {
  console.info(JSON.stringify({ event, ...details }));
};

const createPool = async (): Promise<sql.ConnectionPool> => {
  const credential = new ManagedIdentityCredential(getSqlManagedIdentityClientId());
  const accessToken = await credential.getToken(SQL_SCOPE);
  if (!accessToken) throw new Error('Unable to acquire an Azure SQL managed identity token.');
  const pool = new sql.ConnectionPool({
    server: getSqlServer(),
    database: getSqlDatabase(),
    authentication: {
      type: 'azure-active-directory-access-token',
      options: { token: accessToken.token },
    },
    options: {
      encrypt: true,
      trustServerCertificate: false,
      enableArithAbort: true,
    },
    pool: { max: 3, min: 0, idleTimeoutMillis: 30_000 },
    connectionTimeout: 30_000,
    requestTimeout: 300_000,
  });
  try {
    await pool.connect();
  } catch (error) {
    await pool.close().catch(() => {});
    throw error;
  }
  poolExpiresAt = accessToken.expiresOnTimestamp;
  return pool;
};

const discardPool = async (expected?: Promise<sql.ConnectionPool>): Promise<void> => {
  const current = poolPromise;
  if (!current || (expected && current !== expected)) return;
  poolPromise = undefined;
  poolExpiresAt = 0;
  const pool = await current.catch(() => null);
  await pool?.close().catch(() => {});
};

const connectWithRetry = async (): Promise<sql.ConnectionPool> => {
  const resumeStartedAt = Date.now();
  for (let attempt = 1; attempt <= SQL_CONNECT_ATTEMPTS; attempt += 1) {
    const startedAt = Date.now();
    try {
      const pool = await createPool();
      const attemptDurationMs = Date.now() - startedAt;
      const totalDurationMs = Date.now() - resumeStartedAt;
      logSqlEvent('azure_sql_pool_connected', {
        attempt,
        attemptDurationMs,
        totalDurationMs,
        likelyAutoResume: attempt > 1 || totalDurationMs >= 5_000,
      });
      return pool;
    } catch (error) {
      const retry = isTransientSqlError(error) && attempt < SQL_CONNECT_ATTEMPTS;
      logSqlEvent('azure_sql_pool_connection_failed', {
        attempt,
        attemptDurationMs: Date.now() - startedAt,
        totalDurationMs: Date.now() - resumeStartedAt,
        category: errorCategory(error),
        retry,
      });
      if (!retry) throw error;
      await wait(SQL_RETRY_DELAYS_MS[attempt - 1] ?? SQL_RETRY_DELAYS_MS.at(-1) ?? 0);
    }
  }
  throw new Error('Unable to connect to Azure SQL after bounded retries.');
};

export const getSqlPool = async (): Promise<sql.ConnectionPool> => {
  if (poolPromise) {
    const current = poolPromise;
    try {
      const pool = await current;
      if (Date.now() < poolExpiresAt - 5 * 60_000 && pool.connected && pool.healthy) return pool;
    } catch {
      // The shared connection attempt failed. Clear it so a later request can recover.
    }
    await discardPool(current);
  }

  const connection = connectWithRetry();
  poolPromise = connection;
  try {
    return await connection;
  } catch (error) {
    await discardPool(connection);
    throw error;
  }
};

export const withSqlRetry = async <T>(operation: (pool: sql.ConnectionPool) => Promise<T>): Promise<T> => {
  for (let attempt = 1; attempt <= SQL_OPERATION_ATTEMPTS; attempt += 1) {
    try {
      return await operation(await getSqlPool());
    } catch (error) {
      const retry = isTransientSqlError(error) && attempt < SQL_OPERATION_ATTEMPTS;
      if (!retry) throw error;
      const delayMs = SQL_RETRY_DELAYS_MS[attempt - 1] ?? SQL_RETRY_DELAYS_MS.at(-1) ?? 0;
      logSqlEvent('azure_sql_operation_retry', { attempt, delayMs, category: errorCategory(error) });
      await discardPool();
      await wait(delayMs);
    }
  }
  throw new Error('Azure SQL operation failed after bounded retries.');
};

export { sql };
