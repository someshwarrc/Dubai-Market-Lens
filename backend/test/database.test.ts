import assert from 'node:assert/strict';
import test from 'node:test';
import { isTransientSqlError } from '../src/database.js';

test('recognizes Azure SQL auto-resume and closed-pool failures as transient', () => {
  assert.equal(isTransientSqlError(new Error("Database 'market' is not currently available.")), true);
  assert.equal(isTransientSqlError(Object.assign(new Error('Connection is closed.'), { code: 'ECONNCLOSED' })), true);
  assert.equal(isTransientSqlError({ message: 'Wrapped failure', originalError: { message: 'Service busy', number: 40501 } }), true);
});

test('does not retry configuration, authentication, or query errors by default', () => {
  assert.equal(isTransientSqlError(Object.assign(new Error('Login failed for user.'), { code: 'ELOGIN' })), false);
  assert.equal(isTransientSqlError(new Error('Invalid column name.')), false);
});
