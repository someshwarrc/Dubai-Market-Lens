import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import sql from 'mssql';
import { getScriptSetting } from './scriptConfig.js';
import { createSqlPool } from './sqlConnection.js';

const pool = await createSqlPool();
try {
  await pool.request().query(`IF SCHEMA_ID(N'market_ingest') IS NULL EXEC(N'CREATE SCHEMA market_ingest');
    IF OBJECT_ID(N'market_ingest.schema_migrations', N'U') IS NULL
      CREATE TABLE market_ingest.schema_migrations(version nvarchar(255) NOT NULL PRIMARY KEY, applied_at datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME());`);
  const directory = join(import.meta.dirname, '..', 'sqlserver', 'migrations');
  const files = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort();
  for (const file of files) {
    const applied = await pool.request().input('version', sql.NVarChar(255), file)
      .query('SELECT 1 found FROM market_ingest.schema_migrations WHERE version=@version');
    if (applied.recordset.length) continue;
    const batches = (await readFile(join(directory, file), 'utf8')).split(/^\s*GO\s*$/gim).filter((batch) => batch.trim());
    const transaction = new sql.Transaction(pool); await transaction.begin();
    try {
      for (const batch of batches) await new sql.Request(transaction).batch(batch);
      await new sql.Request(transaction).input('version', sql.NVarChar(255), file)
        .query('INSERT INTO market_ingest.schema_migrations(version) VALUES(@version)');
      await transaction.commit(); process.stdout.write(`Applied ${file}\n`);
    } catch (error) { await transaction.rollback(); throw error; }
  }

  const identityName = await getScriptSetting('AZURE_SQL_MANAGED_IDENTITY_NAME');
  const identityObjectId = await getScriptSetting('AZURE_SQL_MANAGED_IDENTITY_PRINCIPAL_ID');
  if (!identityName || !identityObjectId) throw new Error('Managed identity name and principal ID are required for database access setup.');
  if (!/^[a-zA-Z0-9_-]+$/.test(identityName) || !/^[0-9a-f-]{36}$/i.test(identityObjectId)) throw new Error('Unsafe managed identity metadata.');
  const quotedName = `[${identityName.replaceAll(']', ']]')}]`;
  await pool.request().batch(`IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name=N'${identityName}')
    CREATE USER ${quotedName} FROM EXTERNAL PROVIDER WITH OBJECT_ID='${identityObjectId}';
    ALTER ROLE market_api ADD MEMBER ${quotedName};
    ALTER ROLE market_ingest_writer ADD MEMBER ${quotedName};`);
  process.stdout.write(`Configured Azure SQL access for ${identityName}.\n`);
} finally { await pool.close(); }
