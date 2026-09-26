import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeCursor, encodeCursor } from '../src/pagination.js';

test('round trips an opaque transaction cursor', () => {
  const encoded = encodeCursor({ instanceAt: '2026-09-05T12:00:00.000Z', id: '12345' });
  assert.deepEqual(decodeCursor(encoded), { instanceAt: '2026-09-05T12:00:00.000Z', id: '12345' });
});

test('rejects malformed cursors', () => {
  assert.throws(() => decodeCursor('not-a-cursor'), /invalid pagination cursor/i);
});
