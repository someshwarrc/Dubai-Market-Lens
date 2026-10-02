import assert from 'node:assert/strict';
import test from 'node:test';
import type { HttpRequest } from '@azure/functions';
import { queryWindow } from '../src/functions/queryHelpers.js';

const requestWithQuery = (values: Record<string, string>): HttpRequest => ({
  query: new URLSearchParams(values),
} as unknown as HttpRequest);

test('defaults API queries to 30 days before the requested end date', () => {
  const range = queryWindow(requestWithQuery({ to: '2026-10-02' }));

  assert.equal(range.from.toISOString(), '2026-09-02T00:00:00.000Z');
  assert.equal(range.to.toISOString(), '2026-10-02T00:00:00.000Z');
  assert.equal(range.exclusiveTo.toISOString(), '2026-10-03T00:00:00.000Z');
});

test('uses UTC calendar-day boundaries when dates are omitted', () => {
  const range = queryWindow(requestWithQuery({}));

  assert.equal(range.to.getUTCHours(), 0);
  assert.equal(range.to.getUTCMinutes(), 0);
  assert.equal((range.to.getTime() - range.from.getTime()) / 86_400_000, 30);
  assert.equal((range.exclusiveTo.getTime() - range.to.getTime()) / 86_400_000, 1);
});
