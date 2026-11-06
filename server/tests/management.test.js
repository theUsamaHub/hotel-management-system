import { test, expect, jest } from '@jest/globals';
import { session } from './helpers.js';
import Hotel from '../src/models/Hotel.js';
import User from '../src/models/User.js';
import RoomType from '../src/models/RoomType.js';
import Room from '../src/models/Room.js';
import GuestProfile from '../src/models/GuestProfile.js';
import Reservation from '../src/models/Reservation.js';
import Stay from '../src/models/Stay.js';
import Payment from '../src/models/Payment.js';
import Invoice from '../src/models/Invoice.js';
import Notification from '../src/models/Notification.js';
import HotelPolicy, { policyDefaults } from '../src/models/HotelPolicy.js';
import { billFor } from '../src/services/billing.js';
import { roomSettlement } from '../src/services/billing.js';
import { roomNights } from '../src/services/reports.js';
process.env.HMS_TRANSACTION_TESTS = '1';
const date = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
async function fixture() {
  const admin = await session(); const guest = await session('user');
  const hotel = await Hotel.create({ name: 'Hotel', code: 'KHI', address: 'Road', city: 'Karachi', country: 'Pakistan', email: 'hotel@example.com' });
  const type = await RoomType.create({ hotel: hotel.id, name: 'Double', capacity: 2, rate: 10000, currency: 'PKR' });
  const room = await Room.create({ hotel: hotel.id, roomType: type.id, number: '101' });
  const profile = await GuestProfile.create({ hotel: hotel.id, user: guest.user.id, name: 'Guest', email: 'guest@example.com', phone: '123' });
  const data = { hotel: hotel.id, room: room.id, guest: profile.id, checkIn: date(1), checkOut: date(3), occupants: 1 };
  return { admin, guest, hotel, room, data };
}
const save = (f, values = {}, version = 0) => f.admin.agent.put('/api/hms/policies').send({ hotel: f.hotel.id, version, ...policyDefaults, ...values });
test('policies enforce same-day, maximum stay and booking horizon at search and booking', async () => {
  const f = await fixture();
  expect((await save(f, { allowSameDay: false, maxStayNights: 2, maxAdvanceDays: 5 })).status).toBe(200);
  for (const range of [{ checkIn: date(0), checkOut: date(1) }, { checkIn: date(1), checkOut: date(4) }, { checkIn: date(6), checkOut: date(7) }]) {
    expect((await f.guest.agent.post('/api/hms/reservations').send({ ...f.data, ...range })).status).toBe(400);
    expect((await f.guest.agent.get('/api/hms/availability').query({ hotel: f.hotel.id, occupants: 1, ...range })).status).toBe(400);
  }
  expect((await f.guest.agent.post('/api/hms/reservations').send(f.data)).status).toBe(201);
});
test('existing bookings retain tax and cancellation policy; reception can cancel past cutoff', async () => {
  const f = await fixture();
  await save(f, { taxBps: 1000, cancellationDays: 2 });
  const created = await f.guest.agent.post('/api/hms/reservations').send(f.data);
  expect(created.status).toBe(201);
  const booking = created.body.reservation;
  await save(f, { taxBps: 2500 }, 1);
  const stay = await Stay.create({ hotel: f.hotel.id, reservation: booking._id, room: f.room.id, guest: f.data.guest, owner: f.guest.user.id, verificationNote: 'Verified', checkedInAt: new Date(), checkedInBy: f.admin.user.id });
  expect(await billFor(stay)).toMatchObject({ taxBps: 1000, tax: 2000, total: 22000 });
  expect((await f.guest.agent.post(`/api/hms/reservations/${booking._id}/cancel`).send({ version: 0, reason: 'Changed plans' })).status).toBe(409);
  expect((await f.guest.agent.put(`/api/hms/reservations/${booking._id}`).send({ room: f.room.id, occupants: 1, checkIn: date(10), checkOut: date(12), version: 0 })).status).toBe(409);
  expect((await f.admin.agent.post(`/api/hms/reservations/${booking._id}/cancel`).send({ version: 0, reason: 'Approved exception' })).status).toBe(200);
});

test('global settings apply only to hotels without overrides; old bookings retain their price', async () => {
  const f = await fixture();
  const settings = { ...policyDefaults, version: 0, taxBps: 500, weekendRateBps: 12500 };
  expect((await f.guest.agent.put('/api/hms/settings').send(settings)).status).toBe(403);
  expect((await f.admin.agent.put('/api/hms/settings').send(settings)).status).toBe(200);
  expect((await f.admin.agent.get('/api/hms/policies').query({ hotel: f.hotel.id })).body).toMatchObject({ source: 'global', policy: { taxBps: 500 } });
  let arrival = 1; while (new Date(date(arrival)).getUTCDay() !== 6) arrival += 1;
  const data = { ...f.data, checkIn: date(arrival), checkOut: date(arrival + 2) };
  const availability = await f.guest.agent.get('/api/hms/availability').query({ hotel: f.hotel.id, checkIn: data.checkIn, checkOut: data.checkOut, occupants: 1 });
  expect(availability.body.rooms[0].quoteRate).toBe(12500);
  const created = await f.guest.agent.post('/api/hms/reservations').send(data);
  expect(created.body.reservation.quote.total).toBe(25000);
  await save(f, { taxBps: 1000 });
  await f.admin.agent.put('/api/hms/settings').send({ ...settings, version: 1, taxBps: 2000, weekendRateBps: 20000 });
  expect((await f.admin.agent.get('/api/hms/policies').query({ hotel: f.hotel.id })).body).toMatchObject({ source: 'hotel', policy: { taxBps: 1000 } });
  expect((await Reservation.findById(created.body.reservation._id)).policy.taxBps).toBe(500);
  expect((await f.admin.agent.put('/api/hms/settings').send(settings)).status).toBe(409);
  expect((await f.admin.agent.post('/api/hms/policies/reset').send({ hotel: f.hotel.id, version: 1 })).status).toBe(200);
  expect((await f.admin.agent.get('/api/hms/policies').query({ hotel: f.hotel.id })).body).toMatchObject({ source: 'global', policy: { taxBps: 2000, version: 2 } });
  expect((await save(f, {}, 1)).status).toBe(409);
});

test('saved check-in hour is enforced and checkout overdue nights use the saved hour', async () => {
  const f = await fixture();
  await save(f, { checkInHour: 15, checkOutHour: 11 });
  const created = await f.admin.agent.post('/api/hms/reservations').send({ ...f.data, checkIn: date(0), checkOut: date(2) });
  const booking = created.body.reservation;
  expect((await f.admin.agent.post(`/api/hms/reservations/${booking._id}/confirm`).send({ version: 0 })).status).toBe(200);
  const RealDate = Date;
  const today = date(0);
  // Freeze wall time only; MongoDB and networking retain real timers.
  const freeze = (iso) => { global.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [iso])); } static now() { return RealDate.parse(iso); } }; };
  try {
    freeze(`${today}T14:00:00Z`);
    expect((await f.admin.agent.post(`/api/hms/reservations/${booking._id}/check-in`).send({ version: 1, guestVerified: true, verificationNote: 'Verified', keys: ['101-A'] })).status).toBe(409);
    freeze(`${today}T15:00:00Z`);
    expect((await f.admin.agent.post(`/api/hms/reservations/${booking._id}/check-in`).send({ version: 1, guestVerified: true, verificationNote: 'Verified', keys: ['101-A'] })).status).toBe(201);
    const due = { ...booking, checkOut: today };
    freeze(`${date(1)}T10:59:00Z`);
    expect(roomSettlement(due).extraNights).toBe(0);
    freeze(`${new RealDate(RealDate.parse(today) + 86400000).toISOString().slice(0, 10)}T11:00:00Z`);
    expect(roomSettlement(due).extraNights).toBe(1);
  } finally { global.Date = RealDate; }
});

test('occupied room nights exclude departure and future dates and count a room once', () => {
  const stays = [{ room: '101', checkedInAt: '2026-01-01T15:00:00Z', checkedOutAt: '2026-01-03T10:00:00Z' }, { room: '102', checkedInAt: '2026-01-02T12:00:00Z' }];
  expect(roomNights(stays, '2026-01-01', '2026-01-05', new Date('2026-01-03T12:00:00Z')).map((row) => row.occupiedRooms)).toEqual([1, 2, 1, 0]);
});

test('monitoring is admin-only and returns request IDs without guest data', async () => {
  const f = await fixture();
  expect((await f.guest.agent.get('/api/hms/monitoring')).status).toBe(403);
  const response = await f.admin.agent.get('/api/hms/monitoring');
  expect(response.status).toBe(200);
  expect(response.headers['x-request-id']).toMatch(/^[a-f0-9-]{36}$/);
  expect(response.body.metrics.requests).toBeGreaterThan(0);
  expect(JSON.stringify(response.body)).not.toContain('guest@example.com');
});
test('policy writes reject guests, other hotels, stale concurrent updates and invalid input', async () => {
  const f = await fixture(); const manager = await session('manager');
  const body = { hotel: f.hotel.id, version: 0, ...policyDefaults };
  expect((await f.guest.agent.put('/api/hms/policies').send(body)).status).toBe(403);
  expect((await manager.agent.put('/api/hms/policies').send(body)).status).toBe(404);
  await User.updateOne({ _id: manager.user.id }, { hotel: f.hotel.id });
  expect((await manager.agent.put('/api/hms/policies').send({ ...body, taxBps: -1 })).status).toBe(400);
  expect((await Promise.all([save(f), save(f)])).map((r) => r.status).sort()).toEqual([200, 409]);
  expect(await HotelPolicy.countDocuments()).toBe(1);
});
test('notifications are private, read idempotently and are rolled back with failed bookings', async () => {
  const f = await fixture();
  const spy = jest.spyOn(Notification, 'insertMany').mockRejectedValueOnce(new Error('notification failure'));
  expect((await f.guest.agent.post('/api/hms/reservations').send(f.data)).status).toBe(500);
  spy.mockRestore();
  expect(await Reservation.countDocuments()).toBe(0);
  expect((await f.guest.agent.post('/api/hms/reservations').send(f.data)).status).toBe(201);
  const response = await f.guest.agent.get('/api/hms/notifications').query({ hotel: f.hotel.id, unread: 'true' });
  expect(response.body.notifications).toHaveLength(1);
  const notification = response.body.notifications[0];
  expect((await f.admin.agent.post(`/api/hms/notifications/${notification._id}/read`).send({})).status).toBe(404);
  for (let i = 0; i < 2; i++) expect((await f.guest.agent.post(`/api/hms/notifications/${notification._id}/read`).send({})).status).toBe(200);
  expect((await f.guest.agent.get('/api/hms/notifications').query({ hotel: f.hotel.id, unread: 'true' })).body.pagination.total).toBe(0);
  expect((await f.admin.agent.get('/api/hms/notifications').query({ hotel: f.hotel.id, unread: 'true' })).body.pagination.total).toBe(1);
});
test('reports separate currencies, receipt dates, issued invoices and protect hotel data', async () => {
  const f = await fixture();
  const booking = (await f.guest.agent.post('/api/hms/reservations').send(f.data)).body.reservation;
  const stay = await Stay.create({ hotel: f.hotel.id, reservation: booking._id, room: f.room.id, guest: f.data.guest, verificationNote: 'Verified', checkedInAt: new Date(), checkedInBy: f.admin.user.id });
  await Payment.create([{ hotel: f.hotel.id, stay: stay.id, amount: 500, currency: 'PKR', method: 'cash', reference: 'A', recordedBy: f.admin.user.id }, { hotel: f.hotel.id, stay: stay.id, amount: 200, currency: 'USD', method: 'cash', reference: 'B', recordedBy: f.admin.user.id }]);
  await Invoice.create({ hotel: f.hotel.id, stay: stay.id, status: 'draft', total: 999 });
  const query = { hotel: f.hotel.id, from: date(0), to: date(2) };
  const report = (await f.admin.agent.get('/api/hms/reports').query(query)).body.report;
  expect(report.reservations).toEqual([{ _id: 'pending', count: 1 }]);
  expect(report.payments).toEqual(expect.arrayContaining([{ _id: 'PKR', amount: 500, count: 1 }, { _id: 'USD', amount: 200, count: 1 }]));
  expect(report.invoices).toEqual([]);
  await Invoice.updateOne({ stay: stay.id }, { status: 'issued', issuedAt: new Date(), currency: 'PKR', subtotal: 1000, discount: 100, tax: 90, total: 990 });
  const updated = (await f.admin.agent.get('/api/hms/reports').query(query)).body.report;
  expect(updated.invoices).toEqual([{ _id: 'PKR', subtotal: 1000, discount: 100, tax: 90, total: 990, count: 1 }]);
  expect(updated.forecast.every((row) => row.expectedRooms === null && row.suggestedRateBps === null)).toBe(true);
  expect((await f.guest.agent.get('/api/hms/reports').query(query)).status).toBe(403);
  const manager = await session('manager');
  expect((await manager.agent.get('/api/hms/reports').query(query)).status).toBe(404);
  expect((await f.admin.agent.get('/api/hms/reports').query({ ...query, to: date(400) })).status).toBe(400);
  expect((await f.admin.agent.get('/api/hms/reports').query({ ...query, from: date(-2), to: date(0) })).body.report.payments).toEqual([]);
});
