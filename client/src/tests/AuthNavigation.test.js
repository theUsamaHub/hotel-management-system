import { expect, test } from 'vitest';
import { accountDestination, returnPath } from '../utils/auth.js';

test('login returns guests to the requested module with query and fragment intact', () => {
  expect(returnPath({ role: 'user' }, '/user/operations?tab=services#requests'))
    .toBe('/user/operations?tab=services#requests');
});

test('public guest links resolve to the administrator operations workspace', () => {
  expect(accountDestination({ role: 'admin' }, '/user/reservations'))
    .toBe('/admin/operations?tab=reservations');
  expect(accountDestination({ role: 'manager' }, '/user/services'))
    .toBe('/user/operations?tab=services');
});

test('return destinations reject external URLs and inaccessible admin routes', () => {
  for (const target of ['https://example.com', '//example.com', '/\\example.com', '/admin/dashboard', undefined]) {
    expect(returnPath({ role: 'user' }, target)).toBe('/user/dashboard');
  }
});
