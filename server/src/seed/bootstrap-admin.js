import mongoose from 'mongoose';
import { z } from 'zod';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';

// Intentionally additive: never clear collections or promote an existing account.
try {
  const credentials = z.object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(12).max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72),
  }).safeParse({ name: process.env.ADMIN_NAME, email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
  if (!credentials.success) throw new Error('Set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD (12–72 bytes) in server/.env.');
  await connectDB();
  await User.init();
  if (await User.exists({ email: credentials.data.email })) throw new Error('Account already exists; no changes made.');
  await User.create({ ...credentials.data, role: 'admin' });
  console.log('Administrator created. Sign in with the configured credentials.');
} catch (error) {
  console.error(error.message.startsWith('Set ADMIN_') || error.message.startsWith('Account already') ? error.message : 'Admin setup failed. Check database access and configuration.');
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
