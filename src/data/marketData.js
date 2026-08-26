import initSqlJs from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { titleCase } from '../utils/formatters';

const DATABASE_URL = '/dubai-market.sqlite.gz?v=2026-08-26';
const SQLITE_HEADER = 'SQLite format 3\u0000';

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
  const payload = new Uint8Array(await response.arrayBuffer());
  const header = new TextDecoder().decode(payload.slice(0, SQLITE_HEADER.length));
  if (header === SQLITE_HEADER) return payload;

  const gzipEncoded = payload[0] === 0x1f && payload[1] === 0x8b;
  if (!gzipEncoded || !globalThis.DecompressionStream) {
    throw new Error('The market dataset is neither SQLite nor a supported gzip archive.');
  }

  const stream = new Blob([payload]).stream().pipeThrough(new DecompressionStream('gzip'));
  const databaseBytes = new Uint8Array(await new Response(stream).arrayBuffer());
  const databaseHeader = new TextDecoder().decode(databaseBytes.slice(0, SQLITE_HEADER.length));
  if (databaseHeader !== SQLITE_HEADER) throw new Error('The decompressed market dataset is not a valid SQLite database.');
  return databaseBytes;
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
    masterProjectKey: normalizeKey(row.MASTER_PROJECT_EN),
    project: row.PROJECT_EN || 'Unspecified',
    projectKey: normalizeKey(row.PROJECT_EN),
  };
};

const normalizeProject = (row, index) => ({
  id: `project-${row.PROJECT_NUMBER || index}`,
  projectNumber: row.PROJECT_NUMBER || '',
  project: row.PROJECT_EN || 'Unspecified',
  projectKey: normalizeKey(row.PROJECT_EN),
  developerNumber: row.DEVELOPER_NUMBER || '',
  developer: titleCase(row.DEVELOPER_EN || 'Unspecified'),
  developerKey: normalizeKey(row.DEVELOPER_EN),
  startDate: row.START_DATE?.slice(0, 10) ?? '',
  endDate: row.END_DATE?.slice(0, 10) ?? '',
  projectType: row.PRJ_TYPE_EN || 'Unspecified',
  projectValue: toNumber(row.PROJECT_VALUE),
  projectStatus: row.PROJECT_STATUS || 'Unknown',
  percentCompleted: toNumber(row.PERCENT_COMPLETED),
  completionDate: row.COMPLETION_DATE?.slice(0, 10) ?? '',
  description: row.DESCRIPTION_EN || '',
  registeredArea: titleCase(row.AREA_EN || 'Unspecified'),
  registeredAreaKey: normalizeKey(row.AREA_EN),
  zone: row.ZONE_EN || 'Unspecified',
  unitCount: toNumber(row.CNT_UNIT),
  masterProject: row.MASTER_PROJECT_EN || 'Unspecified',
  masterProjectKey: normalizeKey(row.MASTER_PROJECT_EN),
});

const normalizeAreaLocation = (row) => ({
  areaKey: row.AREA_KEY || normalizeKey(row.AREA_EN),
  area: titleCase(row.AREA_EN || 'Unknown'),
  latitude: toNumber(row.LATITUDE),
  longitude: toNumber(row.LONGITUDE),
  displayName: row.DISPLAY_NAME || '',
  source: row.SOURCE || 'Unknown',
  confidence: row.CONFIDENCE || 'Approximate',
});

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

const attachProjectMetadata = (transactions, projects) => {
  const projectsByName = new Map();
  projects.forEach((project) => {
    if (!project.projectKey) return;
    const matches = projectsByName.get(project.projectKey) ?? [];
    matches.push(project);
    projectsByName.set(project.projectKey, matches);
  });

  transactions.forEach((transaction) => {
    const matches = projectsByName.get(transaction.projectKey) ?? [];
    const project = matches.length === 1 ? matches[0] : null;
    transaction.projectLinkStatus = project ? 'Exact' : matches.length > 1 ? 'Ambiguous' : 'Unavailable';
    transaction.projectNumber = project?.projectNumber ?? '';
    transaction.developer = project?.developer ?? '';
    transaction.developerKey = project?.developerKey ?? '';
    transaction.projectStatus = project?.projectStatus ?? '';
    transaction.projectPercentCompleted = project?.percentCompleted ?? 0;
    transaction.projectRegisteredArea = project?.registeredArea ?? '';
    transaction.projectRegisteredAreaKey = project?.registeredAreaKey ?? '';
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
  const projectRows = queryRows(database, 'SELECT * FROM projects');
  const areaLocationRows = queryRows(database, 'SELECT * FROM area_locations');
  database.close();

  const projects = projectRows.map(normalizeProject);
  const transactions = attachProjectMetadata(
    attachTransactionMultiplicity(transactionRows.map(normalizeTransaction)),
    projects,
  );

  return {
    transactions,
    valuations: valuationRows.map(normalizeValuation),
    projects,
    areaLocations: areaLocationRows.map(normalizeAreaLocation),
  };
};
