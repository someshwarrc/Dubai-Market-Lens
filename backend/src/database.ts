import { ManagedIdentityCredential } from '@azure/identity';
import sql from 'mssql';
import { getSqlDatabase, getSqlManagedIdentityClientId, getSqlServer } from './config.js';

const SQL_SCOPE = 'https://database.windows.net/.default';
let poolPromise: Promise<sql.ConnectionPool> | undefined;
let poolExpiresAt = 0;

const createPool = async (): Promise<sql.ConnectionPool> => {
  const credential = new ManagedIdentityCredential(getSqlManagedIdentityClientId());
  const accessToken = await credential.getToken(SQL_SCOPE);
  if (!accessToken) throw new Error('Unable to acquire an Azure SQL managed identity token.');
  poolExpiresAt = accessToken.expiresOnTimestamp;
  return new sql.ConnectionPool({
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
  }).connect();
};

export const getSqlPool = async (): Promise<sql.ConnectionPool> => {
  if (poolPromise && Date.now() < poolExpiresAt - 5 * 60_000) return poolPromise;
  if (poolPromise) {
    const oldPool = await poolPromise.catch(() => null);
    await oldPool?.close().catch(() => {});
  }
  poolPromise = createPool().catch((error) => {
    poolPromise = undefined;
    throw error;
  });
  return poolPromise;
};

export { sql };
