import { z } from 'zod';
export const dashboardSchema = z.object({ query: z.object({
  hotel: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid hotel identifier').transform((value) => value.toLowerCase()).optional(),
  currency: z.enum(['PKR', 'USD', 'EUR', 'GBP', 'AED']).default('PKR'),
  convert: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  days: z.coerce.number().refine((value) => [7, 30, 90].includes(value), 'Select 7, 30 or 90 days').default(30),
}).strict() });
