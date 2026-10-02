import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAreaOpportunities,
  buildPriceTrends,
  createDefaultFilters,
  getTransactionDateRange,
  selectOpportunityValuations,
} from './marketAnalytics.js';

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

test('groups only meaningful local valuation opportunities by area', () => {
  const rows = [
    { areaKey: 'business-bay', area: 'Business Bay', discountPct: 20, estimatedSaving: 200_000, confidence: 'High' },
    { areaKey: 'business-bay', area: 'Business Bay', discountPct: 16, estimatedSaving: 100_000, confidence: 'Medium' },
    { areaKey: 'marina', area: 'Dubai Marina', discountPct: 14, estimatedSaving: 50_000, confidence: 'High' },
    { areaKey: 'marina', area: 'Dubai Marina', discountPct: 30, estimatedSaving: 300_000, confidence: 'Exploratory' },
  ];

  assert.deepEqual(buildAreaOpportunities(rows), [{
    areaKey: 'business-bay',
    area: 'Business Bay',
    discounts: [20, 16],
    opportunities: 2,
    saving: 300_000,
    highConfidence: 1,
    mediumConfidence: 1,
    medianDiscount: 18,
  }]);
});

test('selects the valuation rows used by local opportunity benchmark rules', () => {
  const valuations = [
    { id: 'v1', date: '2026-09-01', areaKey: 'business-bay', propertyTypeKey: 'unit', subTypeKey: 'flat', actualWorth: 2_000_000, actualArea: 100, pricePerSqm: 20_000 },
    { id: 'v2', date: '2026-08-01', areaKey: 'business-bay', propertyTypeKey: 'unit', subTypeKey: 'office', actualWorth: 3_000_000, actualArea: 100, pricePerSqm: 30_000 },
    { id: 'v3', date: '2026-09-01', areaKey: 'marina', propertyTypeKey: 'unit', subTypeKey: 'flat', actualWorth: 2_000_000, actualArea: 100, pricePerSqm: 20_000 },
  ];
  const opportunities = [{ benchmarkBasis: 'Area + type + subtype', propertyTypeKey: 'unit', subTypeKey: 'flat' }];

  assert.deepEqual(selectOpportunityValuations(valuations, 'business-bay', opportunities).map((row) => row.id), ['v1']);
});
