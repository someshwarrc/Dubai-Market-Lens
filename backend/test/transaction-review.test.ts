import assert from 'node:assert/strict';
import test from 'node:test';
import { canReviewTransactions } from '../src/auth/supabaseAuth.js';
import { parseTransactionReview } from '../src/functions/reviewTransaction.js';
import { parseFavoriteRequest } from '../src/functions/transactionFavorites.js';

test('accepts the supported transaction review decisions', () => {
  assert.deepEqual(parseTransactionReview({ transactionNumber: ' 123-456 ', decision: 'disliked' }), {
    transactionNumber: '123-456',
    decision: 'disliked',
  });
  assert.equal(parseTransactionReview({ transactionNumber: '123-456', decision: 'neutral' }).decision, 'neutral');
  assert.throws(() => parseTransactionReview({ transactionNumber: '123-456', decision: 'deleted' }), /decision/);
  assert.throws(() => parseTransactionReview({ transactionNumber: '', decision: 'liked' }), /transactionNumber/);
});

test('authorizes only confirmed allow-listed or app-role reviewers', () => {
  const baseUser = { id: 'user-id', email: 'reviewer@example.com', email_confirmed_at: '2026-10-01T00:00:00Z' };
  assert.equal(canReviewTransactions(baseUser, ['reviewer@example.com']), true);
  assert.equal(canReviewTransactions({ ...baseUser, email: 'admin@example.com', app_metadata: { role: 'admin' } }, []), true);
  assert.equal(canReviewTransactions({ ...baseUser, email: 'staff@example.com', app_metadata: { review_role: 'reviewer' } }, []), true);
  assert.equal(canReviewTransactions({ ...baseUser, email: 'viewer@example.com', app_metadata: { role: 'viewer' } }, []), false);
  assert.equal(canReviewTransactions({ ...baseUser, email_confirmed_at: null }, ['reviewer@example.com']), false);
});

test('accepts explicit favorite state and rejects malformed requests', () => {
  assert.deepEqual(parseFavoriteRequest({ transactionNumber: ' 11-29563-2026 ', favorite: true }), {
    transactionNumber: '11-29563-2026',
    favorite: true,
  });
  assert.equal(parseFavoriteRequest({ transactionNumber: '11-29563-2026', favorite: false }).favorite, false);
  assert.throws(() => parseFavoriteRequest({ transactionNumber: '', favorite: true }), /transactionNumber/);
  assert.throws(() => parseFavoriteRequest({ transactionNumber: '11-29563-2026', favorite: 'yes' }), /favorite/);
});
