import { describe, expect, it } from 'vitest';
import { errorMessage } from '../api/axios.js';

describe('API error messages', () => {
  it.each([
    {},
    { response: { status: 500, data: '' } },
    { response: { status: 502, data: 'Bad gateway' } },
    { response: { status: 503 } },
    { response: { status: 504 } },
  ])('explains unavailable API responses', (error) => {
    expect(errorMessage(error)).toBe('Unable to reach the server. Please try again shortly.');
  });

  it('preserves actionable API messages', () => {
    expect(errorMessage({ response: { status: 401, data: { message: 'Invalid credentials' } } })).toBe('Invalid credentials');
  });

  it('uses a generic message for other server errors', () => {
    expect(errorMessage({ response: { status: 500, data: {} } })).toBe('Something went wrong. Please try again.');
  });
});
