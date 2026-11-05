import { test, expect } from '@jest/globals';
import { session } from './helpers.js';
import Hotel from '../src/models/Hotel.js';
import User from '../src/models/User.js';
import AuditEvent from '../src/models/AuditEvent.js';
process.env.HMS_TRANSACTION_TESTS = '1';

const property = { name: 'LuxuryStay Karachi', code: 'KHI-01', address: '1 Main Road', city: 'Karachi', country: 'Pakistan', email: 'karachi@example.com', phone: '+92 21 1234567' };
const employee = (hotel) => ({ name: 'Reception Team', email: 'reception@example.com', password: 'StaffPassword123!', role: 'receptionist', hotel, phone: '123456', jobTitle: 'Front desk', isActive: true });

test('admin creates, searches, updates and deactivates hotels with audit events', async () => {
  const { agent } = await session();
  const created = await agent.post('/api/hotels').send(property);
  expect(created.status).toBe(201);
  const id = created.body.hotel._id;
  expect((await agent.post('/api/hotels').send(property)).status).toBe(409);
  expect((await agent.get('/api/hotels?search=Karachi')).body.pagination.total).toBe(1);
  expect((await agent.put(`/api/hotels/${id}`).send({ ...property, isActive: false })).body.hotel.isActive).toBe(false);
  expect(await AuditEvent.countDocuments({ action: { $in: ['hotel.create', 'hotel.update'] } })).toBe(2);
});

test('guests cannot access hotels or staff and cannot register with elevated roles', async () => {
  const { agent } = await session('user');
  expect((await agent.get('/api/hotels')).status).toBe(403);
  expect((await agent.get('/api/staff')).status).toBe(403);
  expect((await agent.post('/api/hotels').send(property)).status).toBe(403);
  expect((await agent.post('/api/auth/register').send({ name: 'Escalation', email: 'attack@example.com', password: 'Password123!', role: 'admin' })).status).toBe(400);
});

test('hotel assignment scopes manager and staff access, including inactive hotels', async () => {
  const first = await Hotel.create(property);
  const second = await Hotel.create({ ...property, code: 'LHE-01', city: 'Lahore' });
  const { agent, user } = await session('manager');
  await User.updateOne({ _id: user._id }, { hotel: first._id });
  await User.create(employee(second.id));
  expect((await agent.get('/api/hotels')).body.hotels.map((hotel) => hotel._id)).toEqual([first.id]);
  expect((await agent.get(`/api/hotels/${second.id}`)).status).toBe(404);
  expect((await agent.get('/api/staff')).body.staff.map((staff) => staff._id)).toEqual([user.id]);
  expect((await agent.post('/api/staff').send(employee(first.id))).status).toBe(403);
  expect((await agent.put(`/api/hotels/${first.id}`).send(property)).status).toBe(403);
  await Hotel.updateOne({ _id: first._id }, { isActive: false });
  expect((await agent.get('/api/hotels')).body.hotels).toEqual([]);
  expect((await agent.get(`/api/hotels/${first.id}`)).status).toBe(404);
  expect((await agent.get('/api/staff')).status).toBe(403);
});

test('staff creation hashes passwords and assignment changes revoke existing sessions', async () => {
  const { agent } = await session();
  const hotel = await Hotel.create(property);
  const second = await Hotel.create({ ...property, code: 'LHE-01' });
  const created = await agent.post('/api/staff').send(employee(hotel.id));
  expect(created.status).toBe(201);
  expect(created.body.user.password).toBeUndefined();
  const id = created.body.user._id;
  const stored = await User.findById(id).select('+password');
  expect(stored.password).not.toBe(employee(hotel.id).password);
  expect(await stored.comparePassword(employee(hotel.id).password)).toBe(true);
  const { agent: staffAgent } = await session('housekeeping');
  await staffAgent.post('/api/auth/login').send({ email: stored.email, password: employee(hotel.id).password });
  expect((await staffAgent.get('/api/hotels')).body.hotels[0]._id).toBe(hotel.id);
  const update = employee(second.id);
  delete update.email;
  delete update.password;
  expect((await agent.put(`/api/staff/${id}`).send(update)).status).toBe(200);
  expect((await staffAgent.get('/api/auth/me')).status).toBe(401);
  await staffAgent.post('/api/auth/login').send({ email: stored.email, password: employee(hotel.id).password });
  expect((await staffAgent.get('/api/hotels')).body.hotels[0]._id).toBe(second.id);
  expect((await agent.put(`/api/staff/${id}`).send({ ...update, isActive: false })).status).toBe(200);
  expect((await staffAgent.get('/api/auth/me')).status).toBe(401);
});

test('validation rejects invalid IDs, injected fields and inactive or missing assignments', async () => {
  const { agent } = await session();
  const hotel = await Hotel.create({ ...property, isActive: false });
  expect((await agent.post('/api/staff').send(employee(hotel.id))).status).toBe(400);
  expect((await agent.post('/api/staff').send(employee('507f1f77bcf86cd799439011'))).status).toBe(400);
  expect((await agent.post('/api/staff').send({ ...employee(hotel.id), role: 'admin' })).status).toBe(400);
  expect((await agent.post('/api/hotels').send({ ...property, createdBy: 'forged' })).status).toBe(400);
  expect((await agent.get('/api/hotels/not-an-id')).status).toBe(400);
  expect((await agent.get('/api/hotels?limit=1000')).status).toBe(400);
});

test('unassigned managers cannot see other properties or staff', async () => {
  await Hotel.create(property);
  const { agent } = await session('manager');
  expect((await agent.get('/api/hotels')).body.hotels).toEqual([]);
  expect((await agent.get('/api/staff')).status).toBe(403);
});
