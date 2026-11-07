import { z } from 'zod';

export const EmailSchema = z.string().email('Invalid email address').max(255);

export const PhoneSchema = z
  .string()
  .trim()
  .regex(/^[+]?[\d\s()-]{7,20}$/, 'Invalid phone number')
  .optional()
  .or(z.literal(''));

export const IdSchema = z.string().cuid('Invalid ID format');

export const SlugSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers, and hyphens');

export const DateRangeSchema = z
  .object({
    startDate: z.string().datetime().or(z.string().date()),
    endDate: z.string().datetime().or(z.string().date()).optional(),
  })
  .refine((d) => !d.endDate || new Date(d.startDate) <= new Date(d.endDate), {
    message: 'startDate must be before endDate',
    path: ['startDate'],
  });

export const CurrencyCodeSchema = z.string().length(3).toUpperCase();

export const BooleanStringSchema = z.union([z.boolean(), z.string(), z.number()]).transform((v) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1;
  return ['true', '1', 'yes'].includes(String(v).toLowerCase());
});
