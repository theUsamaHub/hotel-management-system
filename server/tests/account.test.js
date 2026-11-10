import { test, expect, jest } from '@jest/globals';
import request from './request.js';
import app from '../src/app.js';
import User from '../src/models/User.js';
import EmailJob from '../src/models/EmailJob.js';
import { decodeEmail, deliverNextEmail, emailDelivery } from '../src/utils/email.js';
import { session } from './helpers.js';

const account = { name: 'Account Test', email: 'account@example.com', password: 'Password123!' };
const cookie = (res) => res.headers['set-cookie'].map((v) => v.split(';')[0]).join('; ');
async function latestToken(subject) {
  const jobs = await EmailJob.find().sort({ createdAt: -1 }).select('+payload');
  const mail = jobs.map((job) => decodeEmail(job.payload)).find((m) => m.subject === subject);
  return mail.text.match(/#token=([a-f0-9]{64})/)[1];
}
async function login() {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email: account.email, password: account.password });
  expect(res.status).toBe(200);
  return { agent, cookies: cookie(res) };
}

test('recovery is generic, rate-limits per account, stores hashed tokens and consumes reset once', async () => {
  await User.create(account);
  const first = await login();
  const second = await login();
  const known = await request(app).post('/api/auth/forgot-password').send({ email: account.email });
  const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'missing@example.com' });
  expect(known.body).toEqual(unknown.body);
  await request(app).post('/api/auth/forgot-password').send({ email: account.email });
  expect(await EmailJob.countDocuments()).toBe(1);
  const token = await latestToken('Reset your password');
  const stored = await User.findOne({ email: account.email }).select('+resetHash');
  expect(stored.resetHash).not.toBe(token);
  expect(JSON.stringify((await EmailJob.find().select('+payload')))).not.toContain(token);
  const resets = await Promise.all([1, 2].map(() => request(app).post('/api/auth/reset-password').send({ token, password: 'NewPassword123!' })));
  expect(resets.map((r) => r.status).sort()).toEqual([200, 400]);
  for (const session of [first, second]) {
    expect((await request(app).get('/api/auth/me').set('Cookie', session.cookies)).status).toBe(401);
    expect((await request(app).post('/api/auth/refresh').set('Cookie', session.cookies)).status).toBe(401);
  }
  expect((await request(app).post('/api/auth/login').send({ email: account.email, password: account.password })).status).toBe(401);
  expect((await request(app).post('/api/auth/login').send({ email: account.email, password: 'NewPassword123!' })).status).toBe(200);
});

test('expired and malformed recovery links never update credentials', async () => {
  const user = await User.create(account);
  await request(app).post('/api/auth/forgot-password').send({ email: account.email });
  const token = await latestToken('Reset your password');
  await User.updateOne({ _id: user._id }, { $set: { resetExpires: new Date(0) } });
  for (const value of [token, 'invalid']) {
    expect((await request(app).post('/api/auth/reset-password').send({ token: value, password: 'NewPassword123!' })).status).toBe(400);
  }
});

test('verification is one-use, does not expose token fields, and sends welcome email', async () => {
  const registered = await request(app).post('/api/auth/register').send(account);
  expect(registered.status).toBe(201);
  expect(registered.body.user.emailVerified).toBe(false);
  expect(registered.body.user.verificationHash).toBeUndefined();
  const token = await latestToken('Verify your email address');
  expect((await request(app).post('/api/auth/verify-email').send({ token })).status).toBe(200);
  expect((await User.findOne({ email: account.email })).emailVerified).toBe(true);
  expect((await request(app).post('/api/auth/verify-email').send({ token })).status).toBe(400);
  expect((await EmailJob.find().select('+payload')).map((j) => decodeEmail(j.payload).subject)).toContain('Welcome to LuxuryStay');
});

test('email changes require password, wait for verification, and revoke sessions on confirmation', async () => {
  await User.create(account);
  const { agent, cookies } = await login();
  expect((await agent.post('/api/account/change-email').send({ email: 'new@example.com', currentPassword: 'wrong' })).status).toBe(400);
  expect((await agent.post('/api/account/change-email').send({ email: 'new@example.com', currentPassword: account.password })).status).toBe(200);
  expect((await agent.get('/api/auth/me')).body.user.email).toBe(account.email);
  const token = await latestToken('Verify your email address');
  expect((await request(app).post('/api/auth/verify-email').send({ token })).body.signedOut).toBe(true);
  expect((await User.findOne({ email: 'new@example.com' })).emailVerified).toBe(true);
  expect((await request(app).get('/api/auth/me').set('Cookie', cookies)).status).toBe(401);
});

test('cancelling a pending email invalidates its verification link', async () => {
  await User.create(account);
  const { agent } = await login();
  await agent.post('/api/account/change-email').send({ email: 'new@example.com', currentPassword: account.password });
  const token = await latestToken('Verify your email address');
  expect((await agent.delete('/api/account/pending-email')).status).toBe(200);
  expect((await request(app).post('/api/auth/verify-email').send({ token })).status).toBe(400);
});

test('changing password requires current password and revokes every access token', async () => {
  await User.create(account);
  const { agent, cookies } = await login();
  const other = await login();
  expect((await agent.post('/api/account/change-password').send({ currentPassword: 'wrong', password: 'NewPassword123!' })).status).toBe(400);
  expect((await agent.post('/api/account/change-password').send({ currentPassword: account.password, password: 'NewPassword123!' })).status).toBe(200);
  for (const value of [cookies, other.cookies]) expect((await request(app).get('/api/auth/me').set('Cookie', value)).status).toBe(401);
});

test('device sessions are isolated, owner-only, and immediately revocable', async () => {
  await User.create(account);
  const first = await login();
  const second = await login();
  const list = await first.agent.get('/api/account/sessions');
  expect(list.body.sessions).toHaveLength(2);
  expect(list.body.sessions.filter((s) => s.current)).toHaveLength(1);
  expect(list.body.sessions[0].tokenHash).toBeUndefined();
  const { agent: stranger } = await session('user');
  const other = list.body.sessions.find((s) => !s.current);
  expect((await stranger.delete(`/api/account/sessions/${other._id}`)).status).toBe(404);
  expect((await first.agent.delete(`/api/account/sessions/${other._id}`)).status).toBe(200);
  expect((await request(app).get('/api/auth/me').set('Cookie', second.cookies)).status).toBe(401);
  expect((await first.agent.get('/api/auth/me')).status).toBe(200);
  await login();
  expect((await first.agent.delete('/api/account/sessions/others')).status).toBe(200);
  expect((await first.agent.get('/api/account/sessions')).body.sessions).toHaveLength(1);
});

test('profile changes cannot elevate privileges and audit history is admin-only', async () => {
  const { agent } = await session('user');
  expect((await agent.patch('/api/account/profile').send({ name: 'Updated', role: 'admin' })).status).toBe(400);
  expect((await agent.patch('/api/account/profile').send({ name: 'Updated' })).body.user.name).toBe('Updated');
  expect((await agent.get('/api/audit')).status).toBe(403);
  const { agent: admin } = await session('admin');
  const category = await admin.post('/api/categories').send({ name: 'Audit category' });
  await admin.delete(`/api/categories/${category.body.category._id}`);
  const history = await admin.get('/api/audit?action=category.delete&limit=1');
  expect(history.body.pagination.total).toBe(1);
  expect(history.body.events[0].actor.name).toBe('admin account');
  expect(history.body.events[0].action).toBe('category.delete');
});

test('email worker retries transport failures without discarding queued mail', async () => {
  await request(app).post('/api/auth/register').send(account);
  const send = jest.spyOn(emailDelivery, 'send').mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    await deliverNextEmail();
    expect(await EmailJob.countDocuments()).toBe(1);
    await EmailJob.updateMany({}, { $set: { availableAt: new Date(0) } });
    await deliverNextEmail();
    expect(await EmailJob.countDocuments()).toBe(0);
    expect(send).toHaveBeenCalledTimes(2);
  } finally { send.mockRestore(); log.mockRestore(); }
});
