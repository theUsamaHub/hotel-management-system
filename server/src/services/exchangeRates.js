import ApiError from '../utils/ApiError.js';

let cached;
let pending;
const supported = ['USD', 'PKR', 'EUR', 'GBP', 'AED'];

export async function exchangeRates() {
  if (cached && Date.now() < cached.expires) return cached;
  if (pending) return pending;
  pending = (async () => {
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/USD', {
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error('Rate provider unavailable');
      const data = await response.json();
      const updated = data.time_last_update_unix * 1000;
      if (
        data.result !== 'success' ||
        data.base_code !== 'USD' ||
        !Number.isFinite(updated) ||
        updated > Date.now() + 3600000 ||
        Date.now() - updated > 3 * 86400000 ||
        !supported.every((code) => Number.isFinite(data.rates?.[code]) && data.rates[code] > 0)
      ) {
        throw new Error('Invalid or outdated exchange rates');
      }
      cached = {
        rates: data.rates,
        asOf: new Date(updated).toISOString(),
        expires: Math.min(Date.now() + 86400000, updated + 3 * 86400000),
      };
      return cached;
    } catch {
      throw new ApiError(
        503,
        'Currency conversion is temporarily unavailable. Please retry shortly. Original financial records are unchanged.',
      );
    } finally {
      pending = null;
    }
  })();
  return pending;
}

export function convertMinor(amount, from, to, rates) {
  if (from === to) return amount;
  if (!rates[from] || !rates[to]) throw new ApiError(503, `Exchange rate unavailable for ${from}`);
  return (amount / rates[from]) * rates[to];
}
