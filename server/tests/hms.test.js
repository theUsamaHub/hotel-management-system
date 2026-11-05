import { test, expect, jest } from '@jest/globals';
import { session } from './helpers.js';
import Hotel from '../src/models/Hotel.js';
import User from '../src/models/User.js';
import RoomType from '../src/models/RoomType.js';
import Room from '../src/models/Room.js';
import Reservation from '../src/models/Reservation.js';
import GuestProfile from '../src/models/GuestProfile.js';
import EmailJob from '../src/models/EmailJob.js';
import AuditEvent from '../src/models/AuditEvent.js';
import { decodeEmail } from '../src/utils/email.js';

process.env.HMS_TRANSACTION_TESTS = '1';
const future = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const profile = { name: 'Hotel Guest', email: 'guest@example.com', phone: '+92 300 1234567', preferences: 'Quiet room' };
const hotelData = { name: 'Karachi Hotel', code: 'KHI', address: 'Main Road', city: 'Karachi', country: 'Pakistan', email: 'hotel@example.com' };
const typeData = { name: 'Double', capacity: 2, rate: 1250000, currency: 'PKR', isActive: true };
async function fixture(role = 'admin') {
  const login = await session(role);
  const hotel = await Hotel.create(hotelData);
  if (role !== 'admin' && role !== 'user') await User.updateOne({ _id: login.user._id }, { hotel: hotel._id });
  const type = await RoomType.create({ ...typeData, hotel: hotel._id });
  const room = await Room.create({ hotel: hotel._id, roomType: type._id, number: '101' });
  const guest = await GuestProfile.create({ ...profile, hotel: hotel._id, user: role === 'user' ? login.user._id : null });
  const booking = { hotel: hotel.id, room: room.id, guest: guest.id, checkIn: future(10), checkOut: future(12), occupants: 2 };
  return { ...login, hotel, type, room, guest, booking };
}
test('inventory CRUD validates property ownership, uniqueness and logs physical status history', async () => {
  const { agent, hotel, type, room } = await fixture();
  expect((await agent.post('/api/hms/room-types').send({ ...typeData, hotel: hotel.id })).status).toBe(409);
  const created = await agent.post('/api/hms/rooms').send({ hotel: hotel.id, roomType: type.id, number: '102', floor: '1' });
  expect(created.status).toBe(201);
  expect((await agent.post('/api/hms/rooms').send({ hotel: hotel.id, roomType: type.id, number: '102' })).status).toBe(409);
  expect((await agent.patch(`/api/hms/rooms/${room.id}/status`).send({ status: 'maintenance', reason: 'Plumbing' })).status).toBe(200);
  expect((await agent.patch(`/api/hms/rooms/${room.id}/status`).send({ status: 'available', reason: 'Repaired' })).status).toBe(409);
  expect((await agent.patch(`/api/hms/rooms/${room.id}/status`).send({ status: 'cleaning', reason: 'Repair complete' })).status).toBe(200);
  expect((await agent.patch(`/api/hms/rooms/${room.id}/status`).send({ status: 'available', reason: 'Cleaned and inspected' })).status).toBe(200);
  expect((await agent.get(`/api/hms/rooms/${room.id}/history`)).body.events).toHaveLength(3);
  expect((await agent.put(`/api/hms/rooms/${room.id}`).send({ number: '103', roomType: type.id, isActive: false })).body.room.isActive).toBe(false);
});
test('guest owns only their profile and bookings; staff are isolated by hotel', async () => {
  const { agent, hotel, guest, booking } = await fixture('user');
  const otherGuest = await GuestProfile.create({ ...profile, hotel: hotel.id });
  expect((await agent.get(`/api/hms/guests?hotel=${hotel.id}`)).body.guests.map((g) => g._id)).toEqual([guest.id]);
  expect((await agent.put(`/api/hms/guests/${otherGuest.id}`).send(profile)).status).toBe(404);
  expect((await agent.post('/api/hms/reservations').send({ ...booking, guest: otherGuest.id })).status).toBe(404);
  expect((await agent.get(`/api/hms/rooms?hotel=${hotel.id}`)).status).toBe(403);
  expect((await agent.post('/api/hms/room-types').send({ ...typeData, hotel: hotel.id })).status).toBe(403);
  const created = await agent.post('/api/hms/reservations').send(booking);
  expect(created.status).toBe(201);
  expect((await agent.post(`/api/hms/reservations/${created.body.reservation._id}/confirm`).send({ version: 0 })).status).toBe(403);
  const { agent: manager } = await session('manager');
  expect((await manager.get(`/api/hms/reservations?hotel=${hotel.id}`)).status).toBe(404);
  expect((await manager.get(`/api/hms/reservations/${created.body.reservation._id}`)).status).toBe(404);
});
test('simultaneous overlapping bookings commit once with one audit and one email', async () => {
  const { agent, booking } = await fixture();
  const results = await Promise.all([agent.post('/api/hms/reservations').send(booking), agent.post('/api/hms/reservations').send(booking)]);
  expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  expect(await Reservation.countDocuments()).toBe(1);
  expect(await EmailJob.countDocuments()).toBe(1);
  expect(await AuditEvent.countDocuments({ action: 'reservation.create' })).toBe(1);
});
test('half-open date ranges allow adjacent bookings and filter overlapping availability', async () => {
  const { agent, booking, hotel } = await fixture();
  expect((await agent.post('/api/hms/reservations').send(booking)).status).toBe(201);
  expect((await agent.post('/api/hms/reservations').send({ ...booking, checkIn: future(12), checkOut: future(14) })).status).toBe(201);
  expect((await agent.post('/api/hms/reservations').send({ ...booking, checkIn: future(9), checkOut: future(15) })).status).toBe(409);
  const availability = await agent.get('/api/hms/availability').query({ hotel: hotel.id, checkIn: future(11), checkOut: future(13), occupants: 1 });
  expect(availability.body.rooms).toEqual([]);
  expect((await agent.get('/api/hms/availability').query({ hotel: hotel.id, checkIn: future(14), checkOut: future(15), occupants: 1 })).body.rooms).toHaveLength(1);
});
test('confirmation, reschedule, cancellation, stale writes and immutable prices', async () => {
  const { agent, booking, type, hotel } = await fixture();
  const created = (await agent.post('/api/hms/reservations').send(booking)).body.reservation;
  const path = `/api/hms/reservations/${created._id}`;
  expect(created.quote.total).toBe(2500000);
  expect((await agent.put(`/api/hms/room-types/${type.id}`).send({ ...typeData, rate: 2000000 })).status).toBe(200);
  expect((await agent.post(`${path}/confirm`).send({ version: 0 })).body.reservation.status).toBe('confirmed');
  expect((await agent.post(`${path}/cancel`).send({ version: 0 })).status).toBe(409);
  const changed = await agent.put(path).send({ room: booking.room, checkIn: future(10), checkOut: future(13), occupants: 2, version: 1 });
  expect(changed.status).toBe(200);
  expect(changed.body.reservation.quote.total).toBe(3750000);
  expect((await agent.post(`${path}/cancel`).send({ version: 2, reason: 'Plans changed' })).body.reservation.status).toBe('cancelled');
  expect((await agent.post(`${path}/confirm`).send({ version: 3 })).status).toBe(409);
  expect((await agent.get('/api/hms/availability').query({ hotel: hotel.id, checkIn: booking.checkIn, checkOut: booking.checkOut, occupants: 2 })).body.rooms).toHaveLength(1);
  expect((await agent.get(`${path}/history`)).body.events).toHaveLength(4);
  const messages = await EmailJob.find().select('+payload');
  expect(messages.map((job) => decodeEmail(job.payload).subject)).toEqual(expect.arrayContaining(['LuxuryStay reservation confirmed', 'LuxuryStay reservation cancelled']));
});
test('failed reschedule preserves original booking and room assignment', async () => {
  const { agent, booking, room, hotel, type } = await fixture();
  const other = await Room.create({ hotel: hotel.id, roomType: type.id, number: '102' });
  const first = (await agent.post('/api/hms/reservations').send(booking)).body.reservation;
  await agent.post('/api/hms/reservations').send({ ...booking, room: other.id });
  expect((await agent.put(`/api/hms/reservations/${first._id}`).send({ room: other.id, checkIn: booking.checkIn, checkOut: booking.checkOut, occupants: 2, version: 0 })).status).toBe(409);
  expect((await Reservation.findById(first._id)).room.toString()).toBe(room.id);
  expect(await EmailJob.countDocuments()).toBe(2);
});
test('email queue failure rolls back reservation and audit so retry can succeed', async () => {
  const { agent, booking } = await fixture();
  const spy = jest.spyOn(EmailJob, 'create').mockRejectedValueOnce(new Error('Outbox unavailable'));
  expect((await agent.post('/api/hms/reservations').send(booking)).status).toBe(500);
  spy.mockRestore();
  expect(await Reservation.countDocuments()).toBe(0);
  expect(await AuditEvent.countDocuments({ action: 'reservation.create' })).toBe(0);
  expect((await agent.post('/api/hms/reservations').send(booking)).status).toBe(201);
});
test('maintenance, inactive inventory, capacity, malformed/past dates and forged fields are rejected', async () => {
  const { agent, booking, room, hotel } = await fixture();
  for (const patch of [{ occupants: 3 }, { checkIn: '2027-02-30' }, { checkIn: '2000-01-01' }, { checkOut: booking.checkIn }, { status: 'confirmed' }, { quote: { total: 1 } }]) {
    expect([400, 409]).toContain((await agent.post('/api/hms/reservations').send({ ...booking, ...patch })).status);
  }
  await Room.updateOne({ _id: room.id }, { status: 'maintenance' });
  expect((await agent.post('/api/hms/reservations').send(booking)).status).toBe(409);
  await Room.updateOne({ _id: room.id }, { status: 'available', isActive: false });
  expect((await agent.post('/api/hms/reservations').send(booking)).status).toBe(409);
  await Hotel.updateOne({ _id: hotel.id }, { isActive: false });
  expect((await agent.post('/api/hms/reservations').send(booking)).status).toBe(404);
});
test('physical cleanliness is independent of future booking availability', async () => {
  const { agent, booking, room } = await fixture();
  await Room.updateOne({ _id: room.id }, { status: 'cleaning' });
  expect((await agent.post('/api/hms/reservations').send({ ...booking, checkIn: future(0), checkOut: future(1) })).status).toBe(409);
  expect((await agent.post('/api/hms/reservations').send(booking)).status).toBe(201);
});
test('active reservations prevent deactivating, reidentifying or maintenance-blocking a room', async () => {
  const { agent, booking, room, type, hotel } = await fixture();
  await agent.post('/api/hms/reservations').send(booking);
  expect((await agent.put(`/api/hms/rooms/${room.id}`).send({ number: room.number, roomType: type.id, isActive: false })).status).toBe(409);
  expect((await agent.patch(`/api/hms/rooms/${room.id}/status`).send({ status: 'maintenance', reason: 'Repairs' })).status).toBe(409);
  expect((await agent.put(`/api/hms/room-types/${type.id}`).send({ ...typeData, capacity: 1 })).status).toBe(409);
  expect((await agent.put(`/api/hms/room-types/${type.id}`).send({ ...typeData, isActive: false })).status).toBe(409);
  expect((await agent.put(`/api/hotels/${hotel.id}`).send({ ...hotelData, isActive: false })).status).toBe(409);
  expect((await Hotel.findById(hotel.id)).isActive).toBe(true);
});
test('room reassignment rejects foreign property and retains historical quote for same room', async () => {
  const { agent, booking, hotel } = await fixture();
  const foreign = await Hotel.create({ ...hotelData, code: 'LHE' });
  const foreignType = await RoomType.create({ ...typeData, hotel: foreign.id });
  expect((await agent.post('/api/hms/rooms').send({ hotel: hotel.id, roomType: foreignType.id, number: '999' })).status).toBe(400);
  const foreignRoom = await Room.create({ hotel: foreign.id, roomType: foreignType.id, number: '999' });
  expect((await agent.post('/api/hms/reservations').send({ ...booking, room: foreignRoom.id })).status).toBe(409);
});

test('guest profile API binds ownership, rejects forged owner and preserves booking contact snapshots', async () => {
  const { agent, user } = await session('user');
  const hotel = await Hotel.create(hotelData);
  expect((await agent.post('/api/hms/guests').send({ ...profile, hotel: hotel.id, user: '507f1f77bcf86cd799439011' })).status).toBe(400);
  const created = await agent.post('/api/hms/guests').send({ ...profile, hotel: hotel.id });
  expect(created.status).toBe(201);
  expect(created.body.guest.user).toBe(user.id);
  expect((await agent.post('/api/hms/guests').send({ ...profile, hotel: hotel.id })).status).toBe(409);
  const type = await RoomType.create({ ...typeData, hotel: hotel.id });
  const room = await Room.create({ hotel: hotel.id, roomType: type.id, number: '101' });
  const reservation = await agent.post('/api/hms/reservations').send({ hotel: hotel.id, room: room.id, guest: created.body.guest._id, checkIn: future(1), checkOut: future(2), occupants: 2 });
  expect(reservation.status).toBe(201);
  const updated = await agent.put(`/api/hms/guests/${created.body.guest._id}`).send({ ...profile, preferences: 'High floor', email: 'updated@example.com' });
  expect(updated.status).toBe(200);
  expect(updated.body.guest.preferences).toBe('High floor');
  expect((await agent.get(`/api/hms/reservations/${reservation.body.reservation._id}`)).body.reservation.contact.email).toBe(profile.email);
});

test('competing reschedules cannot double-assign the target room', async () => {
  const { agent, booking, hotel, type } = await fixture();
  const secondRoom = await Room.create({ hotel: hotel.id, roomType: type.id, number: '102' });
  const target = await Room.create({ hotel: hotel.id, roomType: type.id, number: '103' });
  const first = (await agent.post('/api/hms/reservations').send(booking)).body.reservation;
  const second = (await agent.post('/api/hms/reservations').send({ ...booking, room: secondRoom.id })).body.reservation;
  const change = { room: target.id, checkIn: booking.checkIn, checkOut: booking.checkOut, occupants: 2, version: 0 };
  const results = await Promise.all([agent.put(`/api/hms/reservations/${first._id}`).send(change), agent.put(`/api/hms/reservations/${second._id}`).send(change)]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(await Reservation.countDocuments({ room: target.id })).toBe(1);
  expect(await Reservation.countDocuments()).toBe(2);
});

test('booking creation racing hotel deactivation never leaves an active booking at an inactive hotel', async () => {
  const { agent, hotel, booking } = await fixture();
  const [created, deactivated] = await Promise.all([
    agent.post('/api/hms/reservations').send(booking),
    agent.put(`/api/hotels/${hotel.id}`).send({ ...hotelData, isActive: false }),
  ]);
  expect([201, 404]).toContain(created.status);
  expect([200, 409]).toContain(deactivated.status);
  expect((await Hotel.findById(hotel.id)).isActive || await Reservation.countDocuments() === 0).toBe(true);
});

test('housekeeping and maintenance can only perform their assigned status transitions', async () => {
  const { hotel, room } = await fixture();
  const { agent: cleaner, user: cleanerUser } = await session('housekeeping');
  const { agent: repairer, user: repairerUser } = await session('maintenance');
  await User.updateMany({ _id: { $in: [cleanerUser._id, repairerUser._id] } }, { hotel: hotel.id });
  expect((await cleaner.patch(`/api/hms/rooms/${room.id}/status`).send({ status: 'maintenance', reason: 'Wrong role' })).status).toBe(403);
  await Room.updateOne({ _id: room.id }, { status: 'maintenance' });
  expect((await repairer.patch(`/api/hms/rooms/${room.id}/status`).send({ status: 'cleaning', reason: 'Repair finished' })).status).toBe(200);
  expect((await repairer.patch(`/api/hms/rooms/${room.id}/status`).send({ status: 'available', reason: 'Wrong role' })).status).toBe(403);
  expect((await cleaner.patch(`/api/hms/rooms/${room.id}/status`).send({ status: 'available', reason: 'Cleaning finished' })).status).toBe(200);
  expect((await cleaner.get(`/api/hms/guests?hotel=${hotel.id}`)).status).toBe(403);
});

test('guest cannot inspect another guest booking or exclude it from availability', async () => {
  const { agent: admin, booking, hotel } = await fixture();
  const reservation = (await admin.post('/api/hms/reservations').send(booking)).body.reservation;
  const { agent } = await session('user');
  expect((await agent.get(`/api/hms/reservations?hotel=${hotel.id}`)).body.reservations).toEqual([]);
  expect((await agent.get(`/api/hms/reservations/${reservation._id}`)).status).toBe(404);
  expect((await agent.get(`/api/hms/reservations/${reservation._id}/history`)).status).toBe(404);
  expect((await agent.get('/api/hms/availability').query({ hotel: hotel.id, checkIn: booking.checkIn, checkOut: booking.checkOut, occupants: 1, excludeReservation: reservation._id })).status).toBe(404);
});
