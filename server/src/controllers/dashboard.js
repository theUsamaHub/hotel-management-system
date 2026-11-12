import mongoose from 'mongoose';
import Hotel from '../models/Hotel.js';
import Room from '../models/Room.js';
import RoomType from '../models/RoomType.js';
import User from '../models/User.js';
import Reservation from '../models/Reservation.js';
import Payment from '../models/Payment.js';
import Invoice from '../models/Invoice.js';
import GuestFeedback from '../models/GuestFeedback.js';
import HousekeepingTask from '../models/HousekeepingTask.js';
import MaintenanceRequest from '../models/MaintenanceRequest.js';
import ServiceRequest from '../models/ServiceRequest.js';
import ApiError from '../utils/ApiError.js';
import { exchangeRates, convertMinor } from '../services/exchangeRates.js';

const day = 86400000;
const iso = (value) => new Date(value).toISOString().slice(0, 10);
export function comparison(current, previous) {
  return { current, previous, change: current - previous,
    percent: previous === 0 ? null : (current - previous) / previous * 100 };
}

export async function adminDashboard(req, res) {
  const { hotel, currency, days, convert } = req.query;
  const fx = convert ? await exchangeRates() : null;
  const now = new Date();
  const today = iso(now);
  const end = Date.parse(today) + day;
  const start = end - days * day;
  const previousStart = start - days * day;
  const scope = hotel ? { hotel: new mongoose.Types.ObjectId(hotel) } : {};
  let dashboard;
  await mongoose.connection.transaction(async (session) => {
    const hotels = await Hotel.find().select('name code isActive').sort({ name: 1, _id: 1 }).session(session).lean();
    if (hotel && !hotels.some((item) => String(item._id) === hotel)) throw new ApiError(404, 'Hotel not found');
    const selectedHotels = hotels.filter((item) => !hotel || String(item._id) === hotel);
    const count = (Model, filter) => Model.countDocuments({ ...scope, ...filter }).session(session);
    async function daily(Model, field, filter = {}, amount) {
      const rows = await Model.aggregate([
        { $match: { ...scope, ...filter, [field]: { $gte: new Date(previousStart), $lt: now } } },
        { $group: { _id: { date: { $dateToString: { date: `$${field}`, format: '%Y-%m-%d', timezone: 'UTC' } }, currency: amount ? '$currency' : null },
          value: { $sum: amount ? `$${amount}` : 1 } } },
      ]).session(session);
      const byDate = new Map();
      for (const row of rows) {
        const value = amount && fx ? convertMinor(row.value, row._id.currency, currency, fx.rates) : row.value;
        byDate.set(row._id.date, (byDate.get(row._id.date) || 0) + value);
      }
      return [...byDate].map(([date, value]) => ({ _id: date, value: Math.round(value) }));
    }
    const series = {};
    // Transaction operations are intentionally sequential for a consistent snapshot.
    series.payments = await daily(Payment, 'createdAt', convert ? {} : { currency }, 'amount');
    series.invoices = await daily(Invoice, 'issuedAt', { ...(convert ? {} : { currency }), status: 'issued' }, 'total');
    series.bookings = await daily(Reservation, 'createdAt');
    const maps = Object.fromEntries(Object.entries(series).map(([key, rows]) => [key, new Map(rows.map((row) => [row._id, row.value]))]));
    const dailyRows = Array.from({ length: days }, (_, index) => {
      const date = iso(start + index * day); const previousDate = iso(previousStart + index * day);
      return { date, previousDate, ...Object.fromEntries(Object.entries(maps).flatMap(([key, values]) => [
        [key, values.get(date) || 0], [`previous${key[0].toUpperCase()}${key.slice(1)}`, values.get(previousDate) || 0],
      ])) };
    });
    const totals = Object.fromEntries(Object.keys(series).map((key) => [key, comparison(
      dailyRows.reduce((sum, row) => sum + row[key], 0),
      dailyRows.reduce((sum, row) => sum + row[`previous${key[0].toUpperCase()}${key.slice(1)}`], 0),
    )]));
    const roomStates = await Room.aggregate([
      { $match: { isActive: true, hotel: { $in: selectedHotels.filter((item) => item.isActive).map((item) => item._id) } } },
      { $lookup: { from: RoomType.collection.name, localField: 'roomType', foreignField: '_id', as: 'type' } },
      { $match: { 'type.isActive': true } },
      { $group: { _id: '$status', count: { $sum: 1 }, blocked: { $sum: { $cond: ['$maintenanceBlocked', 1, 0] } } } },
    ]).session(session);
    const totalRooms = roomStates.reduce((sum, row) => sum + row.count, 0);
    const occupied = roomStates.find((row) => row._id === 'occupied')?.count || 0;
    const bookingStates = await Reservation.aggregate([
      { $match: { ...scope, createdAt: { $gte: new Date(start), $lt: now } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]).session(session);
    const feedback = await GuestFeedback.aggregate([
      { $match: { ...scope, createdAt: { $gte: new Date(start), $lt: now } } },
      { $group: { _id: null, count: { $sum: 1 }, average: { $avg: '$rating' } } },
    ]).session(session);
    const queues = {
      pendingBookings: await count(Reservation, { status: 'pending' }),
      arrivals: await count(Reservation, { status: 'confirmed', checkIn: today }),
      departures: await count(Reservation, { status: 'checked_in', checkOut: today }),
      overdue: await count(Reservation, { status: 'checked_in', checkOut: { $lt: today } }),
      cleaning: await count(HousekeepingTask, { open: true }),
      maintenance: await count(MaintenanceRequest, { status: { $in: ['open', 'in_progress'] } }),
      services: await count(ServiceRequest, { status: { $in: ['pending', 'in_progress'] } }),
    };
    const staff = await count(User, { role: { $in: ['manager', 'receptionist', 'housekeeping', 'maintenance'] }, isActive: true });
    const upcoming = await Reservation.find({ ...scope, status: 'confirmed', checkIn: { $gte: today } })
      .select('reference checkIn checkOut contact.name quote.roomNumber hotel').populate('hotel', 'name')
      .sort({ checkIn: 1, _id: 1 }).limit(6).session(session).lean();
    dashboard = { generatedAt: now.toISOString(), currency, days, hotel: hotel || null, hotels,
      conversion: fx ? { asOf: fx.asOf, source: 'ExchangeRate-API', basis: 'Latest rates applied to both periods; indicative reporting values, not historical settlement rates.' } : null,
      period: { from: iso(start), to: iso(end), previousFrom: iso(previousStart), previousTo: iso(start) },
      totals, daily: dailyRows, roomStates, bookingStates, queues, upcoming, staff,
      properties: { total: selectedHotels.length, active: selectedHotels.filter((item) => item.isActive).length },
      inventory: { total: totalRooms, occupied, occupancyPercent: totalRooms ? occupied / totalRooms * 100 : null,
        blocked: roomStates.reduce((sum, row) => sum + row.blocked, 0) },
      feedback: feedback[0] || { count: 0, average: null },
    };
  }, { readConcern: { level: 'snapshot' } });
  res.json({ success: true, dashboard });
}
