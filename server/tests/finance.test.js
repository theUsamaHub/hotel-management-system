import { test, expect, jest } from '@jest/globals';
import { session } from './helpers.js';
import Hotel from '../src/models/Hotel.js';
import User from '../src/models/User.js';
import RoomType from '../src/models/RoomType.js';
import Room from '../src/models/Room.js';
import GuestProfile from '../src/models/GuestProfile.js';
import Reservation from '../src/models/Reservation.js';
import Stay from '../src/models/Stay.js';
import StayKey from '../src/models/StayKey.js';
import Service from '../src/models/Service.js';
import BillingCharge from '../src/models/BillingCharge.js';
import Payment from '../src/models/Payment.js';
import Invoice from '../src/models/Invoice.js';
import EmailJob from '../src/models/EmailJob.js';

process.env.HMS_TRANSACTION_TESTS = '1';
const date = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
async function fixture() {
  const login = await session();
  const guestLogin = await session('user');
  const hotel = await Hotel.create({ name: 'Hotel', code: 'KHI', address: 'Main Rd', city: 'Karachi', country: 'Pakistan', email: 'hotel@example.com' });
  const type = await RoomType.create({ hotel: hotel.id, name: 'Double', capacity: 2, rate: 10000, currency: 'PKR' });
  const room = await Room.create({ hotel: hotel.id, roomType: type.id, number: '101' });
  const guest = await GuestProfile.create({ hotel: hotel.id, user: guestLogin.user.id, name: 'Guest', email: 'guest@example.com', phone: '123' });
  const reservation = await Reservation.create({ hotel: hotel.id, room: room.id, guest: guest.id, owner: guestLogin.user.id, createdBy: login.user.id, checkIn: date(0), checkOut: date(2), occupants: 2, status: 'confirmed', quote: { roomNumber: '101', roomType: 'Double', rate: 10000, currency: 'PKR', total: 20000, nights: 2 }, contact: { name: 'Guest', email: 'guest@example.com', phone: '123' } });
  const arrival = await login.agent.post(`/api/hms/reservations/${reservation.id}/check-in`).send({ version: 0, guestVerified: true, verificationNote: 'Verified', keys: ['101-A'] });
  expect(arrival.status).toBe(201);
  const stay = arrival.body.stay;
  const key = await StayKey.findOne({ stay: stay._id });
  await login.agent.post(`/api/hms/stays/${stay._id}/keys/${key.id}/close`).send({ version: 0, status: 'returned', note: 'Returned' });
  const service = await Service.create({ hotel: hotel.id, name: 'Laundry', unitPrice: 500, currency: 'PKR' });
  return { ...login, guestLogin, hotel, stay, reservation, room, service, path: `/api/hms/stays/${stay._id}` };
}
const bill = async (f) => (await f.agent.get(`${f.path}/bill`)).body.bill;
async function depart(f) {
  const current = await bill(f);
  return f.agent.post(`${f.path}/check-out`).send({ version: current.version, billingReviewed: true, amount: current.balance, currency: current.currency, method: 'cash', reference: 'CHECKOUT-001' });
}
async function request(f) {
  const result = await f.guestLogin.agent.post('/api/hms/service-requests').send({ stay: f.stay._id, service: f.service.id, quantity: 2, notes: 'Collect laundry' });
  expect(result.status).toBe(201); return result.body.request;
}
test('service prices are snapshotted and concurrent completion produces exactly one charge', async () => {
  const f = await fixture(); const requested = await request(f);
  await Service.updateOne({ _id: f.service.id }, { unitPrice: 2000 });
  expect((await f.agent.post(`/api/hms/service-requests/${requested._id}/action`).send({ version: 0, action: 'start', notes: 'Collected' })).status).toBe(200);
  const complete = () => f.agent.post(`/api/hms/service-requests/${requested._id}/action`).send({ version: 1, action: 'complete', notes: 'Delivered' });
  expect((await Promise.all([complete(), complete()])).map((r) => r.status).sort()).toEqual([200, 409]);
  expect(await BillingCharge.countDocuments()).toBe(1);
  expect((await bill(f)).subtotal).toBe(21000);
});
test('room, services, manual charges, taxes, discounts, deposits and final invoice reconcile', async () => {
  const f = await fixture();
  let current = await bill(f);
  expect((await f.agent.post(`${f.path}/charges`).send({ version: current.version, description: 'Food', quantity: 2, unitAmount: 500 })).status).toBe(201);
  current = await bill(f);
  expect((await f.agent.put(`${f.path}/bill`).send({ version: current.version, discount: 1000, discountReason: 'Manager allowance', taxBps: 1000 })).status).toBe(200);
  current = await bill(f);
  expect(current).toMatchObject({ subtotal: 21000, discount: 1000, tax: 2000, total: 22000, balance: 22000 });
  expect((await f.agent.post(`${f.path}/payments`).send({ version: current.version, amount: 5000, method: 'card', reference: 'TERMINAL-001' })).status).toBe(201);
  current = await bill(f); expect(current.balance).toBe(17000);
  expect((await depart(f)).status).toBe(200);
  const final = await bill(f); expect(final).toMatchObject({ status: 'issued', total: 22000, paid: 22000, balance: 0 });
  expect(final.lines).toHaveLength(2);
  expect(await Payment.countDocuments()).toBe(2);
  expect((await Stay.findById(f.stay._id)).settlement.amount).toBe(22000);
  expect((await f.agent.post(`${f.path}/charges`).send({ version: final.version, description: 'Late edit', quantity: 1, unitAmount: 1 })).status).toBe(409);
  await Reservation.updateOne({ _id: f.reservation.id }, { 'quote.total': 99999 });
  expect((await bill(f)).total).toBe(22000);
});
test('checkout rejects unfinished services; cancelling pending requests adds no charge', async () => {
  const f = await fixture(); const requested = await request(f);
  expect((await depart(f)).status).toBe(409);
  expect((await f.guestLogin.agent.post(`/api/hms/service-requests/${requested._id}/action`).send({ version: 0, action: 'cancel', notes: 'No longer needed' })).status).toBe(200);
  expect(await BillingCharge.countDocuments()).toBe(0);
  expect((await depart(f)).status).toBe(200);
});
test('payment retries, overpayments, duplicate references and stale versions cannot double-count money', async () => {
  const f = await fixture(); const current = await bill(f);
  expect((await f.agent.post(`${f.path}/payments`).send({ version: current.version, amount: 20001, method: 'cash', reference: 'BIG' })).status).toBe(409);
  const data = { version: current.version, amount: 10000, method: 'cash', reference: 'CASH-1' };
  const responses = await Promise.all([f.agent.post(`${f.path}/payments`).send(data), f.agent.post(`${f.path}/payments`).send(data)]);
  expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
  const latest = await bill(f);
  expect((await f.agent.post(`${f.path}/payments`).send({ ...data, version: latest.version, reference: 'cash-1' })).status).toBe(409);
  expect(await Payment.countDocuments()).toBe(1);
});
test('discounts and voided charges cannot leave an overpaid account or erase payment history', async () => {
  const f = await fixture();
  let current = await bill(f);
  const charge = await f.agent.post(`${f.path}/charges`).send({ version: current.version, description: 'Extra', quantity: 1, unitAmount: 1000 });
  current = await bill(f);
  await f.agent.post(`${f.path}/payments`).send({ version: current.version, amount: 21000, method: 'cash', reference: 'FULL' });
  current = await bill(f);
  expect((await f.agent.put(`${f.path}/bill`).send({ version: current.version, taxBps: 0, discount: 100, discountReason: 'Would require refund' })).status).toBe(409);
  expect((await f.agent.post(`${f.path}/charges/${charge.body.charge._id}/void`).send({ version: current.version, reason: 'Would require refund' })).status).toBe(409);
  expect((await bill(f)).balance).toBe(0);
  expect((await depart(f)).status).toBe(200);
  expect(await Payment.countDocuments()).toBe(1);
});
test('only managers authorize discounts; guests cannot change financial records or staff assignments', async () => {
  const f = await fixture(); const receptionist = await session('receptionist');
  await User.updateOne({ _id: receptionist.user.id }, { hotel: f.hotel.id });
  expect((await receptionist.agent.put(`${f.path}/bill`).send({ version: 1, taxBps: 0, discount: 100, discountReason: 'Forbidden' })).status).toBe(403);
  expect((await f.guestLogin.agent.get(`${f.path}/bill`)).status).toBe(200);
  expect((await f.guestLogin.agent.post(`${f.path}/payments`).send({ version: 1, amount: 1, method: 'cash', reference: 'FAKE' })).status).toBe(403);
  const manager = await session('manager');
  expect((await manager.agent.get(`${f.path}/bill`)).status).toBe(404);
  const requested = await request(f);
  expect((await f.guestLogin.agent.post(`/api/hms/service-requests/${requested._id}/action`).send({ version: 0, action: 'complete', notes: 'Free service' })).status).toBe(403);
  expect((await f.agent.put(`/api/hms/service-requests/${requested._id}/assignment`).send({ version: 0, assignedTo: manager.user.id })).status).toBe(400);
});
test('invoice email is queued only for the recorded guest and resends are throttled', async () => {
  const f = await fixture();
  expect((await f.agent.post(`${f.path}/invoice/email`).send({})).status).toBe(409);
  expect((await depart(f)).status).toBe(200);
  expect((await f.guestLogin.agent.post(`${f.path}/invoice/email`).send({})).status).toBe(429);
  await Invoice.updateOne({ stay: f.stay._id }, { lastEmailedAt: new Date(0) });
  expect((await f.guestLogin.agent.post(`${f.path}/invoice/email`).send({ to: 'stranger@example.com' })).status).toBe(400);
  expect((await f.guestLogin.agent.post(`${f.path}/invoice/email`).send({})).status).toBe(200);
});
test('invoice email failure rolls back final invoice, payment and checkout atomically', async () => {
  const f = await fixture(); const current = await bill(f);
  const mock = jest.spyOn(EmailJob, 'create').mockRejectedValueOnce(new Error('Outbox unavailable'));
  const result = await f.agent.post(`${f.path}/check-out`).send({ version: current.version, billingReviewed: true, amount: current.balance, currency: 'PKR', method: 'cash', reference: 'FAILED' });
  mock.mockRestore(); expect(result.status).toBe(500);
  expect(await Invoice.countDocuments({ status: 'issued' })).toBe(0); expect(await Payment.countDocuments()).toBe(0);
  expect((await Stay.findById(f.stay._id)).status).toBe('active');
});
test('feedback requires a completed owned stay, is unique and is summarized per hotel', async () => {
  const f = await fixture(); const body = { stay: f.stay._id, rating: 5, comment: 'Excellent stay' };
  expect((await f.guestLogin.agent.post('/api/hms/feedback').send(body)).status).toBe(409);
  await depart(f);
  expect((await f.guestLogin.agent.post('/api/hms/feedback').send(body)).status).toBe(201);
  expect((await f.guestLogin.agent.post('/api/hms/feedback').send(body)).status).toBe(409);
  expect((await f.agent.post('/api/hms/feedback').send(body)).status).toBe(403);
  const result = await f.agent.get(`/api/hms/feedback?hotel=${f.hotel.id}&rating=5`);
  expect(result.body.summary).toEqual({ total: 1, average: 5 });
  const manager = await session('manager');
  expect((await manager.agent.get(`/api/hms/feedback?hotel=${f.hotel.id}`)).status).toBe(404);
});

test('voids retain charge history and tax rounds once in integer minor units', async () => {
  const f = await fixture(); let current = await bill(f);
  const charge = await f.agent.post(`${f.path}/charges`).send({ version: current.version, description: 'Small charge', quantity: 1, unitAmount: 3 });
  current = await bill(f);
  expect((await f.agent.put(`${f.path}/bill`).send({ version: current.version, taxBps: 5000, discount: 0 })).status).toBe(200);
  current = await bill(f); expect(current.tax).toBe(10002);
  expect((await f.agent.post(`${f.path}/charges/${charge.body.charge._id}/void`).send({ version: current.version, reason: 'Entered by mistake' })).status).toBe(200);
  const result = await bill(f); expect(result.total).toBe(30000); expect(result.charges[0].status).toBe('voided');
  expect(result.charges[0].voidReason).toBe('Entered by mistake');
});

test('inactive or different-currency services and forged prices cannot be requested', async () => {
  const f = await fixture(); const payload = { stay: f.stay._id, service: f.service.id, quantity: 1 };
  expect((await f.guestLogin.agent.post('/api/hms/service-requests').send({ ...payload, unitPrice: 0 })).status).toBe(400);
  await Service.updateOne({ _id: f.service.id }, { currency: 'USD' });
  expect((await f.guestLogin.agent.post('/api/hms/service-requests').send(payload)).status).toBe(409);
  await Service.updateOne({ _id: f.service.id }, { currency: 'PKR', isActive: false });
  expect((await f.guestLogin.agent.post('/api/hms/service-requests').send(payload)).status).toBe(404);
  await depart(f); await Service.updateOne({ _id: f.service.id }, { isActive: true });
  expect((await f.guestLogin.agent.post('/api/hms/service-requests').send(payload)).status).toBe(409);
});

test('non-owner guests cannot view bills, request services, email invoices or review a stay', async () => {
  const f = await fixture();
  await Stay.updateOne({ _id: f.stay._id }, { owner: null });
  expect((await f.guestLogin.agent.get(`${f.path}/bill`)).status).toBe(404);
  expect((await f.guestLogin.agent.post('/api/hms/service-requests').send({ stay: f.stay._id, service: f.service.id, quantity: 1 })).status).toBe(404);
  await depart(f);
  expect((await f.guestLogin.agent.post(`${f.path}/invoice/email`).send({})).status).toBe(404);
  expect((await f.guestLogin.agent.post('/api/hms/feedback').send({ stay: f.stay._id, rating: 5, comment: 'Not mine' })).status).toBe(404);
});

test('catalog APIs and assigned workers fulfill a request without changing its saved price', async () => {
  const f = await fixture(); const cleaner = await session('housekeeping');
  await User.updateOne({ _id: cleaner.user.id }, { hotel: f.hotel.id });
  const values = { name: 'Room service', description: 'Food delivery', unitPrice: 1250, currency: 'PKR', isActive: true };
  const created = await f.agent.post('/api/hms/services').send({ ...values, hotel: f.hotel.id });
  expect(created.status).toBe(201);
  expect((await f.guestLogin.agent.post('/api/hms/services').send({ ...values, hotel: f.hotel.id })).status).toBe(403);
  const requested = await f.guestLogin.agent.post('/api/hms/service-requests').send({ stay: f.stay._id, service: created.body.service._id, quantity: 2 });
  expect(requested.status).toBe(201);
  expect((await f.agent.put(`/api/hms/services/${created.body.service._id}`).send({ ...values, unitPrice: 2500, isActive: false })).status).toBe(200);
  const path = `/api/hms/service-requests/${requested.body.request._id}`;
  expect((await f.agent.put(`${path}/assignment`).send({ version: 0, assignedTo: cleaner.user.id })).status).toBe(200);
  expect((await cleaner.agent.get(`/api/hms/service-requests?hotel=${f.hotel.id}`)).body.requests).toHaveLength(1);
  expect((await cleaner.agent.post(`${path}/action`).send({ version: 1, action: 'start', notes: 'Preparing' })).status).toBe(200);
  expect((await cleaner.agent.post(`${path}/action`).send({ version: 2, action: 'complete', notes: 'Delivered' })).status).toBe(200);
  expect((await bill(f)).subtotal).toBe(22500);
  expect((await cleaner.agent.get(`${f.path}/bill`)).status).toBe(403);
});
