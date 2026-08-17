import initSqlJs from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { titleCase } from '../utils/formatters';

const DATABASE_URL = '/dubai-market.sqlite.gz';

export const normalizeKey = (value = '') =>
  String(value).trim().toLowerCase().replace(/\s+/g, ' ');

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const queryRows = (database, sql) => {
  const [result] = database.exec(sql);
  if (!result) return [];
  return result.values.map((values) =>
    Object.fromEntries(result.columns.map((column, index) => [column, values[index]])),
  );
};

const downloadDatabase = async () => {
  const response = await fetch(new URL(DATABASE_URL, globalThis.location.href));
  if (!response.ok) throw new Error(`Unable to load market data (${response.status})`);
  if (!response.body || !globalThis.DecompressionStream) {
    throw new Error('This browser does not support the compressed market dataset.');
  }

  const stream = response.body.pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

const normalizeTransaction = (row, index) => {
  const date = row.INSTANCE_DATE?.slice(0, 10) ?? '';
  const areaKey = normalizeKey(row.AREA_EN);
  const propertyTypeKey = normalizeKey(row.PROP_TYPE_EN);
  const subTypeKey = normalizeKey(row.PROP_SB_TYPE_EN);

  return {
    id: `tx-${index}`,
    transactionNumber: row.TRANSACTION_NUMBER || `Unknown-${index}`,
    date,
    month: date.slice(0, 7),
    group: row.GROUP_EN || 'Unknown',
    procedure: row.PROCEDURE_EN || 'Unknown',
    planStatus: row.IS_OFFPLAN_EN || 'Unknown',
    tenure: row.IS_FREE_HOLD_EN || 'Unknown',
    usage: row.USAGE_EN || 'Unknown',
    area: titleCase(row.AREA_EN || 'Unknown'),
    areaKey,
    propertyType: row.PROP_TYPE_EN || 'Unknown',
    propertyTypeKey,
    subType: row.PROP_SB_TYPE_EN || 'Unspecified',
    subTypeKey,
    value: toNumber(row.TRANS_VALUE),
    procedureArea: toNumber(row.PROCEDURE_AREA),
    actualArea: toNumber(row.ACTUAL_AREA),
    rooms: row.ROOMS_EN || 'Unspecified',
    parking: toNumber(row.PARKING),
    nearestMetro: row.NEAREST_METRO_EN || 'Unspecified',
    nearestMall: row.NEAREST_MALL_EN || 'Unspecified',
    nearestLandmark: row.NEAREST_LANDMARK_EN || 'Unspecified',
    buyerCount: toNumber(row.TOTAL_BUYER),
    sellerCount: toNumber(row.TOTAL_SELLER),
    masterProject: row.MASTER_PROJECT_EN || 'Unspecified',
    project: row.PROJECT_EN || 'Unspecified',
  };
};

const normalizeValuation = (row, index) => {
  const date = row.INSTANCE_DATE?.slice(0, 10) ?? '';
  const areaKey = normalizeKey(row.AREA_EN);
  const propertyTypeKey = normalizeKey(row.PROPERTY_TYPE_EN);
  const subTypeKey = normalizeKey(row.PROP_SUB_TYPE_EN);
  const actualArea = toNumber(row.ACTUAL_AREA);
  const actualWorth = toNumber(row.ACTUAL_WORTH);

  return {
    id: `val-${index}`,
    procedureNumber: row.PROCEDURE_NUMBER || `Unknown-${index}`,
    procedureYear: row.PROCEDURE_YEAR || date.slice(0, 4),
    date,
    month: date.slice(0, 7),
    area: titleCase(row.AREA_EN || 'Unknown'),
    areaKey,
    propertyType: row.PROPERTY_TYPE_EN || 'Unknown',
    propertyTypeKey,
    subType: row.PROP_SUB_TYPE_EN || 'Unspecified',
    subTypeKey,
    totalValue: toNumber(row.PROPERTY_TOTAL_VALUE),
    actualWorth,
    procedureArea: toNumber(row.PROCEDURE_AREA),
    actualArea,
    pricePerSqm: actualArea > 0 ? actualWorth / actualArea : 0,
  };
};

const attachTransactionMultiplicity = (transactions) => {
  const counts = new Map();
  transactions.forEach((row) => counts.set(row.transactionNumber, (counts.get(row.transactionNumber) ?? 0) + 1));
  transactions.forEach((row) => {
    row.assetCount = counts.get(row.transactionNumber) ?? 1;
  });
  return transactions;
};

export const loadMarketData = async () => {
  const [SQL, databaseBytes] = await Promise.all([
    initSqlJs({ locateFile: () => sqlWasmUrl }),
    downloadDatabase(),
  ]);

  const database = new SQL.Database(databaseBytes);
  const transactionRows = queryRows(database, 'SELECT * FROM transactions');
  const valuationRows = queryRows(database, 'SELECT * FROM valuations');
  database.close();

  return {
    transactions: attachTransactionMultiplicity(transactionRows.map(normalizeTransaction)),
    valuations: valuationRows.map(normalizeValuation),
  };
};
