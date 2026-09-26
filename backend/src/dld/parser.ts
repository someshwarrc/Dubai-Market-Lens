import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import { DLD_COLUMNS, type DldCsvRecord } from './contract.js';

export interface ParsedDldRow {
  transactionNumber: string;
  instanceAt: Date;
  groupName: string;
  procedureName: string;
  offPlanStatus: string;
  freeholdStatus: string;
  usageName: string;
  areaName: string;
  propertyType: string;
  propertySubType: string;
  transactionValue: number;
  actualArea: number;
  rooms: string;
  nearestMetro: string;
  nearestMall: string;
  nearestLandmark: string;
  projectName: string;
  sourceRowHash: string;
  duplicateOrdinal: number;
}

const numberValue = (value: string, column: string): number => {
  if (!value.trim()) return 0;
  const parsed = Number(value.replaceAll(',', ''));
  if (!Number.isFinite(parsed)) throw new Error(`Invalid numeric value in ${column}`);
  return parsed;
};

export const parseDldTimestamp = (value: string): Date => {
  const trimmed = value.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  let year: string;
  let month: string;
  let day: string;
  let hour = '00';
  let minute = '00';
  let second = '00';

  if (isoMatch) {
    [, year, month, day, hour = '00', minute = '00', second = '00'] = isoMatch;
  } else if (usMatch) {
    const [, parsedMonth, parsedDay, parsedYear, parsedHour = '00', parsedMinute = '00', parsedSecond = '00'] = usMatch;
    year = parsedYear;
    month = parsedMonth.padStart(2, '0');
    day = parsedDay.padStart(2, '0');
    hour = parsedHour.padStart(2, '0');
    minute = parsedMinute;
    second = parsedSecond;
  } else {
    throw new Error('Invalid INSTANCE_DATE format');
  }

  const result = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}+04:00`);
  if (Number.isNaN(result.getTime())) throw new Error('Invalid INSTANCE_DATE value');
  return result;
};

export const sourceRowHash = (record: DldCsvRecord): string => createHash('sha256')
  .update(DLD_COLUMNS.map((column) => record[column].trim()).join('\u001f'))
  .digest('hex');

export const parseDldCsv = (csv: Buffer | string, maximumRows = 250_000): ParsedDldRow[] => {
  let headersValidated = false;
  const records = parse(csv, {
    bom: true,
    columns: (headers: string[]) => {
      const normalizedHeaders = headers.map((header) => header.trim());
      const missing = DLD_COLUMNS.filter((column) => !normalizedHeaders.includes(column));
      if (missing.length) {
        throw new Error(`DLD CSV contract changed. Missing: ${missing.join(', ')}`);
      }
      headersValidated = true;
      return normalizedHeaders;
    },
    skip_empty_lines: true,
    relax_column_count: false,
    trim: true,
  }) as Record<string, string>[];

  if (!headersValidated) throw new Error('DLD CSV is missing its header row');
  if (records.length > maximumRows) throw new Error(`CSV row limit exceeded (${maximumRows})`);
  if (records.length === 0) return [];

  const duplicateCounts = new Map<string, number>();
  return records.map((source, index) => {
    const record = Object.fromEntries(DLD_COLUMNS.map((column) => [column, source[column] ?? ''])) as DldCsvRecord;
    if (!record.TRANSACTION_NUMBER.trim()) throw new Error(`Missing TRANSACTION_NUMBER on row ${index + 2}`);
    const hash = sourceRowHash(record);
    const duplicateKey = `${record.TRANSACTION_NUMBER}\u001f${hash}`;
    const duplicateOrdinal = (duplicateCounts.get(duplicateKey) ?? 0) + 1;
    duplicateCounts.set(duplicateKey, duplicateOrdinal);

    return {
      transactionNumber: record.TRANSACTION_NUMBER.trim(),
      instanceAt: parseDldTimestamp(record.INSTANCE_DATE),
      groupName: record.GROUP_EN,
      procedureName: record.PROCEDURE_EN,
      offPlanStatus: record.IS_OFFPLAN_EN,
      freeholdStatus: record.IS_FREE_HOLD_EN,
      usageName: record.USAGE_EN,
      areaName: record.AREA_EN,
      propertyType: record.PROP_TYPE_EN,
      propertySubType: record.PROP_SB_TYPE_EN,
      transactionValue: numberValue(record.TRANS_VALUE, 'TRANS_VALUE'),
      actualArea: numberValue(record.ACTUAL_AREA, 'ACTUAL_AREA'),
      rooms: record.ROOMS_EN,
      nearestMetro: record.NEAREST_METRO_EN,
      nearestMall: record.NEAREST_MALL_EN,
      nearestLandmark: record.NEAREST_LANDMARK_EN,
      projectName: record.PROJECT_EN,
      sourceRowHash: hash,
      duplicateOrdinal,
    };
  });
};
