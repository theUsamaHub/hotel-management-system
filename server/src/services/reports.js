import Reservation from '../models/Reservation.js';
import Stay from '../models/Stay.js';
import Room from '../models/Room.js';
import GuestFeedback from '../models/GuestFeedback.js';
const day = 86400000;
const date = (value) => new Date(value).toISOString().slice(0, 10);
const add = (value, days) => date(Date.parse(value) + days * day);

// Counts distinct rooms, using arrival-inclusive/departure-exclusive UTC nights.
export function roomNights(stays, from, to, now = new Date()) {
  const endOfToday = add(date(now), 1);
  const nights = new Map();
  for (let value = from; value < to; value = add(value, 1)) nights.set(value, new Set());
  for (const stay of stays) {
    const start = date(stay.checkedInAt);
    const end = stay.checkedOutAt ? date(stay.checkedOutAt) : endOfToday;
    for (const [value, rooms] of nights) if (value >= start && value < end && value < endOfToday) rooms.add(String(stay.room));
  }
  return [...nights].map(([value, rooms]) => ({ date: value, occupiedRooms: rooms.size }));
}
export async function operationalReport(hotel, from, to, session) {
  const now = new Date(); const today = date(now); const historyFrom = add(today, -28);
  const overlaps = (start, end) => ({ checkedInAt: { $lt: new Date(end) }, $or: [{ status: 'active' }, { checkedOutAt: { $gte: new Date(start) } }] });
  const stays = await Stay.find({ hotel, $or: [overlaps(from, to), overlaps(historyFrom, today)] }).select('room checkedInAt checkedOutAt').session(session).lean();
  const rooms = await Room.find({ hotel, isActive: true }).select('status maintenanceBlocked roomType').populate({ path: 'roomType', select: 'isActive' }).session(session).lean();
  const live = rooms.filter((room) => room.roomType?.isActive);
  const occupiedNow = live.filter((room) => room.status === 'occupied').length;
  const busyRooms = await Reservation.distinct('room', { hotel, $or: [{ status: { $in: ['pending', 'confirmed', 'checked_in'] }, checkIn: { $lt: to }, checkOut: { $gt: from } }, { status: 'checked_in', checkOut: { $lte: today } }] }).session(session);
  const busy = new Set(busyRooms.map(String));
  const availability = from < today ? null : live.filter((room) => !room.maintenanceBlocked && room.status !== 'maintenance' && (from !== today || room.status === 'available') && !busy.has(String(room._id))).length;
  const arrivals = await Reservation.aggregate([{ $match: { hotel, checkIn: { $gte: from, $lt: to } } }, { $group: { _id: '$checkIn', arrivals: { $sum: 1 }, cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } } } }]).session(session);
  const feedback = await GuestFeedback.aggregate([{ $match: { hotel, createdAt: { $gte: new Date(from), $lt: new Date(to) } } }, { $group: { _id: { $dateToString: { date: '$createdAt', format: '%Y-%m-%d', timezone: 'UTC' } }, reviews: { $sum: 1 }, rating: { $avg: '$rating' } } }]).session(session);
  const demand = new Map(arrivals.map((row) => [row._id, row])); const ratings = new Map(feedback.map((row) => [row._id, row]));
  const daily = roomNights(stays, from, to, now).map((row) => ({ ...row, arrivals: demand.get(row.date)?.arrivals || 0, cancelled: demand.get(row.date)?.cancelled || 0, reviews: ratings.get(row.date)?.reviews || 0, rating: ratings.get(row.date)?.rating ?? null }));
  const history = roomNights(stays, historyFrom, today, now);
  const firstStay = await Stay.findOne({ hotel }).sort({ checkedInAt: 1 }).select('checkedInAt').session(session).lean();
  const sufficientHistory = !!firstStay && date(firstStay.checkedInAt) <= historyFrom && live.length > 0;
  const forecast = Array.from({ length: 7 }, (_, i) => {
    const value = add(today, i + 1); const weekday = new Date(value).getUTCDay();
    const samples = history.filter((row) => new Date(row.date).getUTCDay() === weekday);
    const expectedRooms = Math.min(live.length, Math.round(samples.reduce((sum, row) => sum + row.occupiedRooms, 0) / samples.length * 100) / 100);
    const occupancy = live.length ? expectedRooms / live.length : 0;
    return { date: value, expectedRooms: sufficientHistory ? expectedRooms : null, suggestedRateBps: !sufficientHistory ? null : occupancy >= 0.8 ? 11000 : occupancy <= 0.3 ? 9500 : 10000 };
  });
  return { daily, occupiedRoomNights: daily.reduce((sum, row) => sum + row.occupiedRooms, 0), inventory: { activeRooms: live.length, occupiedNow, occupancyPercentNow: live.length ? occupiedNow / live.length * 100 : null, availableForEntirePeriod: availability }, forecast, forecastHistory: { sufficientHistory, from: historyFrom, to: today, observedRoomNights: history.reduce((sum, row) => sum + row.occupiedRooms, 0) } };
}
