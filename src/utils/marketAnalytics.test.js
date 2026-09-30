import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPriceTrends, createDefaultFilters, getTransactionDateRange } from './marketAnalytics.js';

test('derives the default date range from the loaded transaction dataset', () => {
  const transactions = [
    { date: '2026-09-27' },
    { date: '2026-01-01' },
    { date: '' },
    { date: '2026-06-15' },
  ];

  assert.deepEqual(getTransactionDateRange(transactions), {
    dateFrom: '2026-01-01',
    dateTo: '2026-09-27',
  });
  assert.deepEqual(
    { dateFrom: createDefaultFilters(transactions, '2026-10-01').dateFrom, dateTo: createDefaultFilters(transactions, '2026-10-01').dateTo },
    { dateFrom: '2026-01-01', dateTo: '2026-10-01' },
  );
});

test('uses an open date range when no dated transactions are loaded', () => {
  assert.deepEqual(getTransactionDateRange([]), { dateFrom: '', dateTo: '' });
});

test('uses null rather than zero when a trend comparison period has no sales', () => {
  const transactions = [{
    id: 'tx-1',
    date: '2026-09-30',
    month: '2026-09',
    group: 'Sales',
    assetCount: 1,
    value: 1_000_000,
    actualArea: 100,
    area: 'Dubai Marina',
    areaKey: 'dubai marina',
    project: 'Example',
    projectKey: 'example',
    propertyType: 'Unit',
    propertyTypeKey: 'unit',
  }];

  const result = buildPriceTrends(transactions, 'area');
  assert.equal(result.rows[0].recentMedianPsm, 10_000);
  assert.equal(result.rows[0].priorMedianPsm, null);
  assert.equal(result.rows[0].changePct, null);
  assert.equal(result.rows[0].trendScore, null);
});
