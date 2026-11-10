import { z } from 'zod';
import { idParams, paginationQuery } from './user.js';

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(8).max(72).refine((v) => Buffer.byteLength(v, 'utf8') <= 72, 'Password must be at most 72 bytes');
const token = z.string().regex(/^[a-f0-9]{64}$/, 'Invalid or expired link');
const currentPassword = z.string().min(1).max(72);
export const forgotSchema = z.object({ body: z.object({ email }).strict() });
export const resetSchema = z.object({ body: z.object({ token, password }).strict() });
export const verifySchema = z.object({ body: z.object({ token }).strict() });
export const passwordSchema = z.object({ body: z.object({ currentPassword, password }).strict() });
export const emailSchema = z.object({ body: z.object({ currentPassword, email }).strict() });
export const profileSchema = z.object({ body: z.object({ name: z.string().trim().min(2).max(80) }).strict() });
export const sessionSchema = z.object({ params: idParams });
export const auditSchema = z.object({ query: paginationQuery.extend({
  action: z.string().max(80).optional(),
  role: z.enum(['admin', 'manager', 'receptionist', 'housekeeping', 'maintenance', 'user']).optional(),
}).strict() });
