import HotelPolicy, { policyDefaults } from '../models/HotelPolicy.js';
import SystemSetting from '../models/SystemSetting.js';
export async function policyFor(hotel, session) {
  const saved = (hotel ? await HotelPolicy.findOne({ hotel, isOverride: { $ne: false } }).session(session || null).lean() : null) || await SystemSetting.findOne({ key: 'policies' }).session(session || null).lean();
  return Object.fromEntries(Object.keys(policyDefaults).map((key) => [key, saved?.[key] ?? policyDefaults[key]]));
}
export function arrivalRate(rate, arrival, policy) {
  const weekend = [0, 6].includes(new Date(`${arrival}T00:00:00Z`).getUTCDay());
  return weekend ? Math.round(rate * policy.weekendRateBps / 10000) : rate;
}
