import { createHash } from 'node:crypto';
import { parseDldTimestamp } from './parser.js';

export const DLD_PROJECTS_URL = 'https://gateway.dubailand.gov.ae/open-data/projects';
export const DLD_VALUATIONS_URL = 'https://gateway.dubailand.gov.ae/open-data/valuations';

type JsonRecord = Record<string, unknown>;

export interface ParsedDldProject {
  projectNumber: string;
  projectName: string;
  developerName: string;
  projectStatus: string;
  percentCompleted: number;
  registeredArea: string;
  sourceRowHash: string;
}

export interface ParsedDldValuation {
  procedureYear: number;
  procedureNumber: string;
  instanceAt: Date;
  areaName: string;
  propertyType: string;
  propertySubType: string;
  propertyTotalValue: number;
  actualWorth: number;
  procedureArea: number;
  actualArea: number;
  sourceRowHash: string;
  duplicateOrdinal: number;
}

const textValue = (record: JsonRecord, key: string): string => String(record[key] ?? '').trim();

const numberValue = (record: JsonRecord, key: string): number => {
  const value = record[key];
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`Invalid numeric value in ${key}`);
  return parsed;
};

const hashValues = (values: Array<string | number>): string => createHash('sha256')
  .update(values.map((value) => String(value).trim()).join('\u001f'))
  .digest('hex');

const resultRows = (payload: unknown, maximumRows: number): JsonRecord[] => {
  if (!payload || typeof payload !== 'object') throw new Error('DLD JSON response is not an object.');
  const root = payload as JsonRecord;
  if (Number(root.responseCode) !== 200) throw new Error(`DLD JSON response code was ${String(root.responseCode)}.`);
  const response = root.response;
  if (!response || typeof response !== 'object') throw new Error('DLD JSON response is missing its response object.');
  const rows = (response as JsonRecord).result;
  if (!Array.isArray(rows)) throw new Error('DLD JSON response is missing its result array.');
  if (rows.length > maximumRows) throw new Error(`DLD JSON row limit exceeded (${maximumRows}).`);
  const normalized = rows.filter((row): row is JsonRecord => Boolean(row) && typeof row === 'object');
  if (normalized.length !== rows.length) throw new Error('DLD JSON response contains an invalid result row.');
  const totalWasDeclared = normalized.length > 0 && normalized[0].TOTAL !== undefined && normalized[0].TOTAL !== null;
  const declaredTotal = totalWasDeclared ? Number(normalized[0].TOTAL) : normalized.length;
  if (totalWasDeclared && Number.isFinite(declaredTotal) && declaredTotal !== normalized.length) {
    throw new Error(`DLD JSON response was truncated (${normalized.length} of ${declaredTotal} rows).`);
  }
  return normalized;
};

export const parseDldProjects = (payload: unknown, maximumRows = 10_000): ParsedDldProject[] => resultRows(payload, maximumRows).map((record) => {
  const projectNumber = textValue(record, 'PROJECT_NUMBER');
  if (!projectNumber) throw new Error('DLD project row is missing PROJECT_NUMBER.');
  const values: Array<string | number> = [
    projectNumber,
    textValue(record, 'PROJECT_EN'),
    textValue(record, 'DEVELOPER_EN'),
    textValue(record, 'PROJECT_STATUS'),
    numberValue(record, 'PERCENT_COMPLETED'),
    textValue(record, 'AREA_EN'),
  ];
  return {
    projectNumber,
    projectName: String(values[1]),
    developerName: String(values[2]),
    projectStatus: String(values[3]),
    percentCompleted: Number(values[4]),
    registeredArea: String(values[5]),
    sourceRowHash: hashValues(values),
  };
});

export const parseDldValuations = (payload: unknown, maximumRows = 100_000): ParsedDldValuation[] => {
  const duplicates = new Map<string, number>();
  return resultRows(payload, maximumRows).map((record) => {
    const procedureYear = numberValue(record, 'PROCEDURE_YEAR');
    const procedureNumber = textValue(record, 'PROCEDURE_NUMBER');
    if (!procedureYear || !procedureNumber) throw new Error('DLD valuation row is missing its procedure identity.');
    const instanceAt = parseDldTimestamp(textValue(record, 'INSTANCE_DATE'));
    const values: Array<string | number> = [
      procedureYear,
      procedureNumber,
      instanceAt.toISOString(),
      textValue(record, 'AREA_EN'),
      textValue(record, 'PROPERTY_TYPE_EN'),
      textValue(record, 'PROP_SUB_TYPE_EN'),
      numberValue(record, 'PROPERTY_TOTAL_VALUE'),
      numberValue(record, 'ACTUAL_WORTH'),
      numberValue(record, 'PROCEDURE_AREA'),
      numberValue(record, 'ACTUAL_AREA'),
    ];
    const sourceRowHash = hashValues(values);
    const duplicateKey = `${procedureYear}\u001f${procedureNumber}\u001f${sourceRowHash}`;
    const duplicateOrdinal = (duplicates.get(duplicateKey) ?? 0) + 1;
    duplicates.set(duplicateKey, duplicateOrdinal);
    return {
      procedureYear,
      procedureNumber,
      instanceAt,
      areaName: String(values[3]),
      propertyType: String(values[4]),
      propertySubType: String(values[5]),
      propertyTotalValue: Number(values[6]),
      actualWorth: Number(values[7]),
      procedureArea: Number(values[8]),
      actualArea: Number(values[9]),
      sourceRowHash,
      duplicateOrdinal,
    };
  });
};

const formatDldDate = (date: Date): string => {
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${month}/${day}/${date.getUTCFullYear()}`;
};

export const buildProjectsPayload = (from: Date, to: Date) => ({
  P_DATE_TYPE: '1',
  P_FROM_DATE: formatDldDate(from),
  P_TO_DATE: formatDldDate(to),
  P_AREA_ID: '',
  P_PRJ_STATUS: '',
  P_PRJ_TYPE_ID: '',
  P_ZONE_ID: '',
  P_TAKE: '-1',
  P_SKIP: '0',
  P_SORT: 'PROJECT_NUMBER_ASC',
});

export const buildValuationsPayload = (from: Date, to: Date) => ({
  P_FROM_DATE: formatDldDate(from),
  P_TO_DATE: formatDldDate(to),
  P_AREA_ID: '',
  P_PROP_TYPE_ID: '',
  P_TAKE: '-1',
  P_SKIP: '0',
  P_SORT: 'PROPERTY_TOTAL_VALUE_ASC',
});
