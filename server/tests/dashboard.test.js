import { test, expect, jest } from '@jest/globals';
import mongoose from 'mongoose';
import { session } from './helpers.js';
import Hotel from '../src/models/Hotel.js';
import RoomType from '../src/models/RoomType.js';
import Room from '../src/models/Room.js';
import Payment from '../src/models/Payment.js';
import Invoice from '../src/models/Invoice.js';
import Reservation from '../src/models/Reservation.js';
import { comparison } from '../src/controllers/dashboard.js';
import { exchangeRates } from '../src/services/exchangeRates.js';
process.env.HMS_TRANSACTION_TESTS = '1';
const id = () => new mongoose.Types.ObjectId();
const day = 86400000;

test('exchange rate outages and stale quotes return an explicit error instead of zero totals', async () => {
  const provider = jest.spyOn(globalThis, 'fetch');
  try {
    provider.mockRejectedValueOnce(new Error('offline'));
    await expect(exchangeRates()).rejects.toMatchObject({ statusCode: 503 });
    provider.mockResolvedValueOnce({ ok: true, json: async () => ({
      result: 'success', base_code: 'USD', time_last_update_unix: Math.floor(Date.now() / 1000) - 7 * 86400,
      rates: { USD: 1, PKR: 250, EUR: 0.9, GBP: 0.8, AED: 3.67 },
    }) });
    await expect(exchangeRates()).rejects.toMatchObject({ statusCode: 503 });
  } finally { provider.mockRestore(); }
});

test('dashboard reconciles currency-specific financial trends, period boundaries, hotel scope and current inventory', async () => {
  const admin = await session();
  const hotel = await Hotel.create({ name: 'Analytics Hotel', code: 'ANALYTICS', address: 'Test', city: 'Karachi', country: 'Pakistan', email: 'analytics@example.com' });
  const other = await Hotel.create({ name: 'Other', code: 'OTHER', address: 'Test', city: 'Karachi', country: 'Pakistan', email: 'other@example.com' });
  const type = await RoomType.create({ hotel: hotel._id, name: 'Double', capacity: 2, rate: 10000 });
  const inactive = await RoomType.create({ hotel: hotel._id, name: 'Inactive', capacity: 2, rate: 10000, isActive: false });
  await Room.create([
    { hotel: hotel._id, roomType: type._id, number: '1', status: 'occupied', maintenanceBlocked: true },
    { hotel: hotel._id, roomType: type._id, number: '2', status: 'available' },
    { hotel: hotel._id, roomType: inactive._id, number: '3', status: 'available' },
  ]);
  const today = Date.parse(new Date().toISOString().slice(0, 10));
  const start = today - 6 * day; const previous = start - 7 * day;
  const receipt = (amount, createdAt, currency = 'PKR', property = hotel._id) => ({ hotel: property, stay: id(), amount, currency, method: 'cash', reference: String(id()), recordedBy: admin.user._id, createdAt: new Date(createdAt) });
  await Payment.insertMany([
    receipt(20000, start), receipt(5000, start + day), receipt(10000, previous),
    receipt(99999, previous - 1), receipt(90000, start, 'USD'), receipt(11111, start, 'PKR', other._id), receipt(500000, today + day),
  ]);
  await Invoice.create([
    { hotel: hotel._id, stay: id(), status: 'issued', currency: 'PKR', total: 7000, issuedAt: new Date(start) },
    { hotel: hotel._id, stay: id(), status: 'draft', currency: 'PKR', total: 99999, issuedAt: new Date(start) },
  ]);
  const booking = (createdAt, status) => ({ hotel: hotel._id, room: id(), guest: id(), createdBy: admin.user._id, checkIn: new Date(today).toISOString().slice(0, 10), checkOut: new Date(today + day).toISOString().slice(0, 10), occupants: 1, status, createdAt: new Date(createdAt) });
  await Reservation.insertMany([booking(start, 'confirmed'), booking(start + day, 'cancelled'), booking(previous, 'pending')]);
  const response = await admin.agent.get('/api/admin/dashboard').query({ hotel: hotel.id.toUpperCase(), days: 7, currency: 'PKR' });
  expect(response.status).toBe(200);
  const d = response.body.dashboard;
  expect(d.totals.payments).toEqual({ current: 25000, previous: 10000, change: 15000, percent: 150 });
  expect(d.totals.invoices.current).toBe(7000);
  expect(d.totals.bookings).toEqual({ current: 2, previous: 1, change: 1, percent: 100 });
  expect(d.daily).toHaveLength(7);
  expect(d.daily.reduce((sum, row) => sum + row.payments, 0)).toBe(d.totals.payments.current);
  expect(d.daily[0].previousPayments).toBe(10000);
  expect(d.daily[2].payments).toBe(0);
  expect(d.inventory).toEqual({ total: 2, occupied: 1, occupancyPercent: 50, blocked: 1 });
  expect(d.queues).toMatchObject({ arrivals: 1, departures: 0, overdue: 0, pendingBookings: 1 });
  expect(d.feedback.average).toBeNull();
  expect(d.upcoming).toHaveLength(1);
  expect(d.bookingStates).toEqual(expect.arrayContaining([{ _id: 'cancelled', count: 1 }]));
  const usd = (await admin.agent.get('/api/admin/dashboard').query({ hotel: hotel.id, days: 7, currency: 'USD' })).body.dashboard;
  expect(usd.totals.payments.current).toBe(90000);
  expect(usd.totals.payments.percent).toBeNull();
  expect(usd.totals.bookings.current).toBe(2);
  const all = (await admin.agent.get('/api/admin/dashboard').query({ days: 7 })).body.dashboard;
  expect(all.totals.payments.current).toBe(36111);
  expect(all.properties.active).toBe(2);
  const fetchRates = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({
    result: 'success', base_code: 'USD', time_last_update_unix: Math.floor(Date.now() / 1000),
    rates: { USD: 1, PKR: 250, EUR: 0.9, GBP: 0.8, AED: 3.67 },
  }) });
  try {
    const converted = await admin.agent.get('/api/admin/dashboard').query({ hotel: hotel.id, days: 7, currency: 'USD', convert: 'true' });
    expect(converted.status).toBe(200);
    const report = converted.body.dashboard;
    expect(report.totals.payments.current).toBe(90100);
    expect(report.totals.payments.previous).toBe(40);
    expect(report.totals.invoices.current).toBe(28);
    expect(report.daily.reduce((sum, row) => sum + row.payments, 0)).toBe(90100);
    expect(report.totals.bookings.current).toBe(2);
    expect(report.conversion.source).toBe('ExchangeRate-API');
    const pkr = await admin.agent.get('/api/admin/dashboard').query({ hotel: hotel.id, days: 7, currency: 'PKR', convert: 'true' });
    expect(pkr.body.dashboard.totals.payments.current).toBe(22525000);
    expect(fetchRates).toHaveBeenCalledTimes(1);
  } finally { fetchRates.mockRestore(); }
});

test('dashboard is admin-only, validates filters and reports empty and declining periods honestly', async () => {
  for (const role of ['user', 'manager', 'receptionist', 'housekeeping', 'maintenance']) {
    const actor = await session(role);
    expect((await actor.agent.get('/api/admin/dashboard')).status).toBe(403);
  }
  const admin = await session();
  for (const params of [{ days: 500 }, { currency: 'BTC' }, { hotel: 'bad' }]) expect((await admin.agent.get('/api/admin/dashboard').query(params)).status).toBe(400);
  expect((await admin.agent.get('/api/admin/dashboard').query({ hotel: String(id()) })).status).toBe(404);
  const d = (await admin.agent.get('/api/admin/dashboard')).body.dashboard;
  expect(d.daily).toHaveLength(30);
  expect(d.inventory.occupancyPercent).toBeNull();
  expect(d.totals.payments).toEqual(comparison(0, 0));
  expect(comparison(50, 100).percent).toBe(-50);
  expect(comparison(0, 100).percent).toBe(-100);
  expect(comparison(100, 0).percent).toBeNull();
});
