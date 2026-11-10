import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { env } from '../config/env.js';
import { seedHotelDemo, demoEmails } from './hotel-demo.js';
const accessFile = new URL('../../demo-access.json', import.meta.url);
try {
  if (env.NODE_ENV === 'production' || env.MAIL_MODE !== 'file') throw new Error('Demo seeding requires non-production mode and MAIL_MODE=file');
  const args = process.argv.slice(2);
  if (args.length) throw new Error('Demo seed takes no arguments; destructive options are not supported');
  let access;
  try { access = JSON.parse(await readFile(accessFile, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!access) {
    access = { password: randomBytes(24).toString('base64url'), accounts: demoEmails };
    await writeFile(accessFile, JSON.stringify(access, null, 2), { flag: 'wx', mode: 0o600 });
  }
  await connectDB();
  const topology = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!topology.setName && topology.msg !== 'isdbgrid') throw new Error('Demo seeding requires a replica set');
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  const result = await seedHotelDemo(access.password);
  console.log(result.skipped ? 'Completed demo already exists; no records changed.' : 'Demo ready: 1 hotel, 6 role accounts, 3 room types, 9 rooms, bookings, stays, services, invoice, work queues, feedback and audit history.');
  console.log('Credentials are saved locally in ignored server/demo-access.json. No credentials were printed.');
} catch {
  console.error('Demo seed stopped. Requires non-production mode, MAIL_MODE=file and a reachable replica set. Inspect demo_seed_runs for an incomplete run; existing data is never deleted.');
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
