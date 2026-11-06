import { test, expect, jest } from '@jest/globals';
import { session } from './helpers.js';
import User from '../src/models/User.js';
import Hotel from '../src/models/Hotel.js';
import Room from '../src/models/Room.js';
import RoomType from '../src/models/RoomType.js';
import GuestProfile from '../src/models/GuestProfile.js';
import Reservation from '../src/models/Reservation.js';
import Stay from '../src/models/Stay.js';
import StayKey from '../src/models/StayKey.js';
import HousekeepingTask from '../src/models/HousekeepingTask.js';
import MaintenanceRequest from '../src/models/MaintenanceRequest.js';
import EmailJob from '../src/models/EmailJob.js';

process.env.HMS_TRANSACTION_TESTS = '1';
const date = (offset = 0) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const now = () => new Date(Date.now() - 1000).toISOString();
const arrival = { version: 0, guestVerified: true, verificationNote: 'Name and booking contact verified in person', keys: ['101-A'] };
const settlement = { version: 1, billingReviewed: true, amount: 20000, currency: 'PKR', method: 'cash', reference: 'Receipt-001' };
async function fixture() {
  const login = await session('admin');
  const hotel = await Hotel.create({ name: 'Hotel', code: 'KHI', address: 'Main Rd', city: 'Karachi', country: 'Pakistan', email: 'hotel@example.com' });
  const type = await RoomType.create({ hotel: hotel.id, name: 'Double', capacity: 2, rate: 10000, currency: 'PKR' });
  const room = await Room.create({ hotel: hotel.id, roomType: type.id, number: '101' });
  const guest = await GuestProfile.create({ hotel: hotel.id, name: 'Guest', email: 'guest@example.com', phone: '123' });
  const booking = await Reservation.create({ hotel: hotel.id, room: room.id, guest: guest.id, createdBy: login.user.id, checkIn: date(), checkOut: date(2), occupants: 2, status: 'confirmed', quote: { roomNumber: '101', roomType: 'Double', rate: 10000, currency: 'PKR', total: 20000, nights: 2 }, contact: { name: 'Guest', email: 'guest@example.com', phone: '123' } });
  return { ...login, hotel, room, type, guest, booking };
}
async function checkIn(f) {
  const result = await f.agent.post(`/api/hms/reservations/${f.booking.id}/check-in`).send(arrival);
  expect(result.status).toBe(201);
  return result.body.stay;
}
async function returnKey(f, stay, status = 'returned') {
  const key = await StayKey.findOne({ stay: stay._id, status: 'issued' });
  const result = await f.agent.post(`/api/hms/stays/${stay._id}/keys/${key.id}/close`).send({ version: stay.version, status, note: status === 'lost' ? 'Guest reported loss' : 'Returned at desk' });
  expect(result.status).toBe(200);
}
test('complete guest flow: confirmed booking, check-in, keys, settlement, checkout, assigned cleaning and ready room', async () => {
  const f = await fixture();
  const stay = await checkIn(f);
  expect((await Room.findById(f.room.id)).status).toBe('occupied');
  expect((await Reservation.findById(f.booking.id)).status).toBe('checked_in');
  expect((await f.agent.post(`/api/hms/stays/${stay._id}/check-out`).send({ ...settlement, version: 0 })).status).toBe(409);
  await returnKey(f, stay);
  const departed = await f.agent.post(`/api/hms/stays/${stay._id}/check-out`).send(settlement);
  expect(departed.status).toBe(200);
  expect(departed.body.stay.settlement.reference).toBe('Receipt-001');
  expect((await Room.findById(f.room.id)).status).toBe('cleaning');
  expect((await Reservation.findById(f.booking.id)).status).toBe('checked_out');
  let task = await HousekeepingTask.findOne({ room: f.room.id, open: true });
  expect(task.required).toBe(true);
  expect((await f.agent.patch(`/api/hms/rooms/${f.room.id}/status`).send({ status: 'available', reason: 'Skip cleaning' })).status).toBe(409);
  const cleaner = await session('housekeeping');
  await User.updateOne({ _id: cleaner.user.id }, { hotel: f.hotel.id });
  expect((await f.agent.put(`/api/hms/housekeeping/${task.id}`).send({ version: 0, assignedTo: cleaner.user.id, scheduledFor: now(), notes: 'Departure cleaning' })).status).toBe(200);
  expect((await cleaner.agent.post(`/api/hms/housekeeping/${task.id}/action`).send({ version: 1, action: 'complete', notes: 'Too early' })).status).toBe(409);
  expect((await cleaner.agent.post(`/api/hms/housekeeping/${task.id}/action`).send({ version: 1, action: 'start', notes: 'Started cleaning' })).status).toBe(200);
  expect((await cleaner.agent.post(`/api/hms/housekeeping/${task.id}/action`).send({ version: 2, action: 'complete', notes: 'Cleaned and inspected' })).status).toBe(200);
  task = await HousekeepingTask.findById(task.id);
  expect(task.status).toBe('completed');
  expect(task.completedBy.toString()).toBe(cleaner.user.id);
  expect((await Room.findById(f.room.id)).status).toBe('available');
  expect((await f.agent.get(`/api/hms/stays/${stay._id}/history`)).body.events.length).toBeGreaterThanOrEqual(3);
});
test('check-in refuses unconfirmed, cancelled, future, expired, unverified, dirty and blocked rooms', async () => {
  const f = await fixture();
  const path = `/api/hms/reservations/${f.booking.id}/check-in`;
  expect((await f.agent.post(path).send({ ...arrival, guestVerified: false })).status).toBe(400);
  for (const fields of [{ status: 'pending' }, { status: 'cancelled' }, { status: 'confirmed', checkIn: date(1) }, { checkIn: date(-2), checkOut: date() }]) {
    await Reservation.updateOne({ _id: f.booking.id }, fields);
    expect((await f.agent.post(path).send(arrival)).status).toBe(409);
  }
  await Reservation.updateOne({ _id: f.booking.id }, { status: 'confirmed', checkIn: date(), checkOut: date(2) });
  for (const fields of [{ status: 'cleaning' }, { status: 'maintenance' }, { status: 'available', maintenanceBlocked: true }, { maintenanceBlocked: false, isActive: false }]) {
    await Room.updateOne({ _id: f.room.id }, fields);
    expect((await f.agent.post(path).send(arrival)).status).toBe(409);
  }
  expect(await Stay.countDocuments()).toBe(0);
});
test('simultaneous check-in attempts produce one active stay and one set of keys', async () => {
  const f = await fixture();
  const path = `/api/hms/reservations/${f.booking.id}/check-in`;
  const responses = await Promise.all([f.agent.post(path).send(arrival), f.agent.post(path).send(arrival)]);
  expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
  expect(await Stay.countDocuments()).toBe(1);
  expect(await StayKey.countDocuments()).toBe(1);
});
test('checkout enforces amount, currency, billing review, key accounting and optimistic version', async () => {
  const f = await fixture(); const stay = await checkIn(f);
  await returnKey(f, stay);
  const path = `/api/hms/stays/${stay._id}/check-out`;
  expect((await f.agent.post(path).send({ ...settlement, billingReviewed: false })).status).toBe(400);
  for (const change of [{ amount: 1 }, { currency: 'USD' }, { version: 0 }]) expect((await f.agent.post(path).send({ ...settlement, ...change })).status).toBe(409);
  const attempts = await Promise.all([f.agent.post(path).send(settlement), f.agent.post(path).send(settlement)]);
  expect(attempts.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(await HousekeepingTask.countDocuments()).toBe(1);
});
test('lost keys block the room and require repair then cleaning after checkout', async () => {
  const f = await fixture(); const stay = await checkIn(f);
  await returnKey(f, stay, 'lost');
  let room = await Room.findById(f.room.id);
  expect(room.status).toBe('occupied'); expect(room.maintenanceBlocked).toBe(true);
  expect((await f.agent.post(`/api/hms/stays/${stay._id}/check-out`).send(settlement)).status).toBe(200);
  const request = await MaintenanceRequest.findOne({ room: f.room.id });
  const task = await HousekeepingTask.findOne({ room: f.room.id, open: true });
  expect((await f.agent.post(`/api/hms/housekeeping/${task.id}/action`).send({ version: task.version, action: 'start', notes: 'Attempt' })).status).toBe(409);
  expect((await f.agent.post(`/api/hms/maintenance/${request.id}/action`).send({ version: 0, action: 'start', notes: 'Reset access' })).status).toBe(200);
  expect((await f.agent.post(`/api/hms/maintenance/${request.id}/action`).send({ version: 1, action: 'resolve', notes: 'Rekeyed and tested access' })).status).toBe(200);
  room = await Room.findById(f.room.id);
  expect(room.maintenanceBlocked).toBe(false); expect(room.status).toBe('cleaning');
  expect(await HousekeepingTask.countDocuments({ room: f.room.id, open: true })).toBe(1);
});
test('multiple blockers keep the room closed until every issue is resolved; reopen blocks it again', async () => {
  const f = await fixture();
  const payload = { hotel: f.hotel.id, room: f.room.id, title: 'Leak', description: 'Repair pipe', blocksRoom: true };
  const a = (await f.agent.post('/api/hms/maintenance').send(payload)).body.request;
  const b = (await f.agent.post('/api/hms/maintenance').send({ ...payload, title: 'Electrical fault' })).body.request;
  expect((await f.agent.put(`/api/hms/maintenance/${a._id}`).send({ version: 0, assignedTo: null, priority: 'normal', blocksRoom: false })).status).toBe(409);
  for (const request of [a, b]) {
    expect((await f.agent.post(`/api/hms/maintenance/${request._id}/action`).send({ version: 0, action: 'start', notes: 'Start repair' })).status).toBe(200);
    expect((await f.agent.post(`/api/hms/maintenance/${request._id}/action`).send({ version: 1, action: 'resolve', notes: 'Repaired and tested' })).status).toBe(200);
    expect((await Room.findById(f.room.id)).maintenanceBlocked).toBe(request === a);
  }
  expect((await Room.findById(f.room.id)).status).toBe('cleaning');
  expect((await f.agent.post(`/api/hms/maintenance/${a._id}/action`).send({ version: 2, action: 'reopen', notes: 'Leak recurred' })).status).toBe(200);
  expect((await Room.findById(f.room.id)).maintenanceBlocked).toBe(true);
  expect((await f.agent.get(`/api/hms/maintenance/${a._id}/history`)).body.events).toHaveLength(4);
});
test('guest issue reports are limited to an active owned room and cannot set blocks or assignments', async () => {
  const f = await fixture(); const guest = await session('user');
  await Reservation.updateOne({ _id: f.booking.id }, { owner: guest.user.id });
  const payload = { hotel: f.hotel.id, room: f.room.id, title: 'AC issue', description: 'Not cooling' };
  expect((await guest.agent.post('/api/hms/maintenance').send(payload)).status).toBe(403);
  const stay = await checkIn(f);
  expect((await guest.agent.post('/api/hms/maintenance').send({ ...payload, blocksRoom: true })).status).toBe(403);
  const created = await guest.agent.post('/api/hms/maintenance').send(payload);
  expect(created.status).toBe(201);
  expect((await guest.agent.get(`/api/hms/maintenance?hotel=${f.hotel.id}`)).body.requests).toHaveLength(1);
  expect((await guest.agent.post(`/api/hms/maintenance/${created.body.request._id}/action`).send({ version: 0, action: 'resolve', notes: 'Not permitted' })).status).toBe(403);
  expect((await guest.agent.get(`/api/hms/stays/${stay._id}`)).status).toBe(200);
  expect((await guest.agent.post(`/api/hms/stays/${stay._id}/check-out`).send(settlement)).status).toBe(403);
});
test('assignments require matching active hotel staff and workers cannot alter others tasks', async () => {
  const f = await fixture(); const cleaner = await session('housekeeping'); const repairer = await session('maintenance');
  const body = { hotel: f.hotel.id, room: f.room.id, scheduledFor: now(), assignedTo: cleaner.user.id };
  expect((await f.agent.post('/api/hms/housekeeping').send(body)).status).toBe(400);
  await User.updateOne({ _id: cleaner.user.id }, { hotel: f.hotel.id });
  const task = (await f.agent.post('/api/hms/housekeeping').send(body)).body.task;
  expect((await f.agent.put(`/api/hms/housekeeping/${task._id}`).send({ version: 0, assignedTo: repairer.user.id, scheduledFor: now() })).status).toBe(400);
  expect((await repairer.agent.get(`/api/hms/stays?hotel=${f.hotel.id}`)).status).toBe(403);
  expect((await cleaner.agent.get(`/api/hms/housekeeping?hotel=${f.hotel.id}`)).body.tasks).toHaveLength(1);
  await User.updateOne({ _id: cleaner.user.id }, { hotel: null });
  expect((await cleaner.agent.post(`/api/hms/housekeeping/${task._id}/action`).send({ version: 0, action: 'start', notes: 'Attempt' })).status).toBe(404);
});
test('scheduled cleaning cannot begin before its time or while the room is occupied', async () => {
  const f = await fixture();
  const task = (await f.agent.post('/api/hms/housekeeping').send({ hotel: f.hotel.id, room: f.room.id, scheduledFor: new Date(Date.now() + 86400000).toISOString() })).body.task;
  expect((await f.agent.post(`/api/hms/housekeeping/${task._id}/action`).send({ version: 0, action: 'start', notes: 'Early attempt' })).status).toBe(409);
  await checkIn(f);
  await f.agent.put(`/api/hms/housekeeping/${task._id}`).send({ version: 0, assignedTo: null, scheduledFor: now() });
  expect((await f.agent.post(`/api/hms/housekeeping/${task._id}/action`).send({ version: 1, action: 'start', notes: 'Occupied attempt' })).status).toBe(409);
});
test('late departure adds snapshot nightly charges and overdue stays block new future reservations', async () => {
  const f = await fixture(); const stay = await checkIn(f);
  await Reservation.updateOne({ _id: f.booking.id }, { checkIn: date(-4), checkOut: date(-2) });
  const detail = await f.agent.get(`/api/hms/stays/${stay._id}`);
  expect(detail.body.settlementDue).toEqual({ roomTotal: 40000, extraNights: 2, currency: 'PKR' });
  expect((await f.agent.get('/api/hms/availability').query({ hotel: f.hotel.id, checkIn: date(5), checkOut: date(7), occupants: 1 })).body.rooms).toEqual([]);
  await returnKey(f, stay);
  expect((await f.agent.post(`/api/hms/stays/${stay._id}/check-out`).send(settlement)).status).toBe(409);
  expect((await f.agent.post(`/api/hms/stays/${stay._id}/check-out`).send({ ...settlement, amount: 40000 })).status).toBe(200);
});
test('email failure rolls back check-in and leaves no stay, keys or occupied room', async () => {
  const f = await fixture();
  const mock = jest.spyOn(EmailJob, 'create').mockRejectedValueOnce(new Error('Outbox unavailable'));
  expect((await f.agent.post(`/api/hms/reservations/${f.booking.id}/check-in`).send(arrival)).status).toBe(500);
  mock.mockRestore();
  expect(await Stay.countDocuments()).toBe(0); expect(await StayKey.countDocuments()).toBe(0);
  expect((await Room.findById(f.room.id)).status).toBe('available');
  expect((await Reservation.findById(f.booking.id)).status).toBe('confirmed');
});

test('blocking an occupied or reserved room prevents future sales and shows affected bookings', async () => {
  const f = await fixture();
  const issue = await f.agent.post('/api/hms/maintenance').send({ hotel: f.hotel.id, room: f.room.id, title: 'Safety repair', description: 'Repair required', blocksRoom: true });
  expect(issue.status).toBe(201);
  expect((await f.agent.get(`/api/hms/maintenance/${issue.body.request._id}/affected`)).body.reservations.map((r) => r._id)).toEqual([f.booking.id]);
  expect((await f.agent.get('/api/hms/availability').query({ hotel: f.hotel.id, checkIn: date(5), checkOut: date(7), occupants: 1 })).body.rooms).toEqual([]);
  expect((await f.agent.post(`/api/hms/reservations/${f.booking.id}/check-in`).send(arrival)).status).toBe(409);
  const replacement = await Room.create({ hotel: f.hotel.id, roomType: f.type.id, number: '102' });
  expect((await f.agent.put(`/api/hms/reservations/${f.booking.id}`).send({ room: replacement.id, checkIn: date(), checkOut: date(2), occupants: 2, version: 0 })).status).toBe(200);
  expect((await f.agent.post(`/api/hms/reservations/${f.booking.id}/check-in`).send({ ...arrival, version: 1 })).status).toBe(201);
});

test('maintenance block racing cleaning completion cannot leave the room available', async () => {
  const f = await fixture();
  await Reservation.updateOne({ _id: f.booking.id }, { status: 'cancelled' });
  const task = (await f.agent.post('/api/hms/housekeeping').send({ hotel: f.hotel.id, room: f.room.id, scheduledFor: now() })).body.task;
  await f.agent.post(`/api/hms/housekeeping/${task._id}/action`).send({ version: 0, action: 'start', notes: 'Started' });
  const [completion, repair] = await Promise.all([
    f.agent.post(`/api/hms/housekeeping/${task._id}/action`).send({ version: 1, action: 'complete', notes: 'Cleaned' }),
    f.agent.post('/api/hms/maintenance').send({ hotel: f.hotel.id, room: f.room.id, title: 'Leaking pipe', description: 'Stop water', blocksRoom: true }),
  ]);
  expect([200, 409]).toContain(completion.status); expect(repair.status).toBe(201);
  const room = await Room.findById(f.room.id);
  expect(room.status).toBe('maintenance'); expect(room.maintenanceBlocked).toBe(true);
});

test('duplicate issued key labels roll back check-in and key operations stay scoped', async () => {
  const f = await fixture(); const firstStay = await checkIn(f);
  const room = await Room.create({ hotel: f.hotel.id, roomType: f.type.id, number: '102' });
  const original = f.booking.toObject(); delete original._id; delete original.reference;
  const second = await Reservation.create({ ...original, room: room.id });
  expect((await f.agent.post(`/api/hms/reservations/${second.id}/check-in`).send(arrival)).status).toBe(409);
  expect(await Stay.countDocuments()).toBe(1);
  expect((await Room.findById(room.id)).status).toBe('available');
  const arrived = await f.agent.post(`/api/hms/reservations/${second.id}/check-in`).send({ ...arrival, keys: ['102-A'] });
  expect(arrived.status).toBe(201);
  const foreignKey = await StayKey.findOne({ stay: firstStay._id });
  expect((await f.agent.post(`/api/hms/stays/${arrived.body.stay._id}/keys/${foreignKey.id}/close`).send({ version: 0, status: 'returned', note: 'Wrong stay' })).status).toBe(409);
  expect((await f.agent.post(`/api/hms/stays/${firstStay._id}/keys`).send({ version: 0, label: '101-B' })).status).toBe(201);
  expect((await f.agent.post(`/api/hms/stays/${firstStay._id}/keys`).send({ version: 0, label: '101-C' })).status).toBe(409);
});

test('unassigned workers and guests cannot access other stays or work history', async () => {
  const f = await fixture(); const stay = await checkIn(f);
  const stranger = await session('user'); const manager = await session('manager');
  expect((await stranger.agent.get(`/api/hms/stays/${stay._id}`)).status).toBe(404);
  expect((await stranger.agent.get(`/api/hms/stays/${stay._id}/history`)).status).toBe(404);
  expect((await manager.agent.get(`/api/hms/stays/${stay._id}`)).status).toBe(404);
  const issue = (await f.agent.post('/api/hms/maintenance').send({ hotel: f.hotel.id, room: f.room.id, title: 'AC noise', description: 'Inspect equipment' })).body.request;
  expect((await stranger.agent.get(`/api/hms/maintenance/${issue._id}/history`)).status).toBe(404);
  expect((await stranger.agent.get(`/api/hms/maintenance/${issue._id}/affected`)).status).toBe(403);
  const repairer = await session('maintenance'); await User.updateOne({ _id: repairer.user.id }, { hotel: f.hotel.id });
  expect((await repairer.agent.post(`/api/hms/maintenance/${issue._id}/action`).send({ version: 0, action: 'start', notes: 'Not assigned' })).status).toBe(404);
});

test('checkout queue failure rolls back departure, settlement and generated cleaning work', async () => {
  const f = await fixture(); const stay = await checkIn(f); await returnKey(f, stay);
  const mock = jest.spyOn(EmailJob, 'create').mockRejectedValueOnce(new Error('Outbox unavailable'));
  expect((await f.agent.post(`/api/hms/stays/${stay._id}/check-out`).send(settlement)).status).toBe(500);
  mock.mockRestore();
  const stored = await Stay.findById(stay._id);
  expect(stored.status).toBe('active'); expect(stored.settlement.amount).toBeUndefined();
  expect(await HousekeepingTask.countDocuments()).toBe(0);
  expect((await Room.findById(f.room.id)).status).toBe('occupied');
  expect((await Reservation.findById(f.booking.id)).status).toBe('checked_in');
});
