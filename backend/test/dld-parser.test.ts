import assert from 'node:assert/strict';
import test from 'node:test';
import { DLD_COLUMNS, buildDldPayload } from '../src/dld/contract.js';
import { parseDldCsv, parseDldTimestamp } from '../src/dld/parser.js';

const row = [
  '101-10-2026', '2026-07-01 16:00:21', 'Sale', 'Sale', 'Ready', 'Free Hold',
  'Residential', 'BUSINESS BAY', 'Unit', 'Flat', '1250000', '75.5',
  '1 B/R', 'Metro', 'Mall', 'Landmark', 'Project',
];

test('parses the official DLD transaction contract and preserves duplicate assets', () => {
  const csv = `${DLD_COLUMNS.join(',')}\n${row.join(',')}\n${row.join(',')}\n`;
  const parsed = parseDldCsv(csv);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].transactionValue, 1_250_000);
  assert.equal(parsed[0].instanceAt.toISOString(), '2026-07-01T12:00:21.000Z');
  assert.equal(parsed[0].duplicateOrdinal, 1);
  assert.equal(parsed[1].duplicateOrdinal, 2);
  assert.equal(parsed[0].sourceRowHash, parsed[1].sourceRowHash);
});

test('rejects a changed CSV contract before ingestion', () => {
  const csv = `${DLD_COLUMNS.slice(0, -1).join(',')},NEW_COLUMN\n${row.slice(0, -1).join(',')},value\n`;
  assert.throws(() => parseDldCsv(csv), /contract changed/i);
});

test('accepts DLD US dates and interprets them in Dubai time', () => {
  assert.equal(parseDldTimestamp('09/05/2026 08:30:00').toISOString(), '2026-09-05T04:30:00.000Z');
});

test('builds the required export payload with MM/DD/YYYY dates', () => {
  const payload = buildDldPayload(new Date('2026-09-04T00:00:00Z'), new Date('2026-09-05T00:00:00Z'));
  assert.equal(payload.parameters.P_FROM_DATE, '09/04/2026');
  assert.equal(payload.parameters.P_TO_DATE, '09/05/2026');
  assert.equal(payload.parameters.P_TAKE, '-1');
  assert.equal(payload.labels.TRANSACTION_NUMBER, 'TRANSACTION_NUMBER');
});
