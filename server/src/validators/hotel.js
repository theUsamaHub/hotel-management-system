import { z } from 'zod';
import { idParams, paginationQuery } from './user.js';
import { STAFF_ROLES } from '../config/roles.js';

const text = (max) => z.string().trim().min(1).max(max);
const hotelFields = z.object({
  name: text(120), code: text(20).toUpperCase().regex(/^[A-Z0-9-]+$/),
  address: text(300), city: text(100), country: text(100),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().max(30).default(''),
  isActive: z.boolean().default(true),
}).strict();
export const hotelListSchema = z.object({ query: paginationQuery.strict() });
export const hotelCreateSchema = z.object({ body: hotelFields });
export const hotelUpdateSchema = z.object({ params: idParams, body: hotelFields });
export const hotelGetSchema = z.object({ params: idParams });
const staffFields = z.object({
  name: text(80).min(2),
  role: z.enum(STAFF_ROLES), hotel: idParams.shape.id,
  phone: z.string().trim().max(30).default(''),
  jobTitle: z.string().trim().max(80).default(''),
  isActive: z.boolean().default(true),
}).strict();
export const staffCreateSchema = z.object({ body: staffFields.extend({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 bytes'),
}) });
export const staffUpdateSchema = z.object({ params: idParams, body: staffFields });
