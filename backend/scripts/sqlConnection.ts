import { AzureCliCredential } from '@azure/identity';
import sql from 'mssql';
import { getScriptSetting } from './scriptConfig.js';

export const createSqlPool = async (): Promise<sql.ConnectionPool> => {
  const server = await getScriptSetting('AZURE_SQL_SERVER');
  const database = await getScriptSetting('AZURE_SQL_DATABASE');
  const tenantId = await getScriptSetting('AZURE_TENANT_ID');
  if (!server || !database) throw new Error('AZURE_SQL_SERVER and AZURE_SQL_DATABASE are required');
  const credential = new AzureCliCredential(tenantId ? { tenantId } : undefined);
  const token = await credential.getToken('https://database.windows.net/.default');
  if (!token) throw new Error('Unable to acquire an Azure SQL token from Azure CLI.');
  return new sql.ConnectionPool({ server, database, authentication: { type: 'azure-active-directory-access-token', options: { token: token.token } },
    options: { encrypt: true, trustServerCertificate: false, enableArithAbort: true }, pool: { max: 2, min: 0, idleTimeoutMillis: 30_000 },
    connectionTimeout: 30_000, requestTimeout: 300_000 }).connect();
};
