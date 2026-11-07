import { describe, expect, it } from '@jest/globals';
import { startupError } from '../src/utils/startupError.js';

describe('safe startup diagnostics', () => {
  it.each([
    ['ETIMEOUT', 'DNS or network'],
    [18, 'authentication failed'],
    [13, 'access denied'],
    [11000, 'Duplicate records'],
    [85, 'index conflicts'],
    ['TRANSACTIONS_UNAVAILABLE', 'replica set'],
  ])('explains error %s without exposing exception values', (code, guidance) => {
    const result = startupError({ code, message: 'mongodb://private-user:private-password@host', keyValue: { email: 'private@example.com' } }, 'database connection');
    expect(result).toContain(guidance);
    expect(result).toContain('database connection');
    expect(result).not.toContain('private');
  });

  it('handles nested network errors and server selection errors', () => {
    expect(startupError({ cause: { code: 'ECONNREFUSED' } }, 'connection')).toContain('DNS or network');
    expect(startupError({ name: 'MongooseServerSelectionError' }, 'connection')).toContain('No database server is reachable');
  });

  it('retains the failure stage for unknown errors without exposing their message', () => {
    expect(startupError(new Error('private values'), 'index initialization for Room')).toBe('Startup failed during index initialization for Room. Check database connectivity and permissions.');
  });
});
