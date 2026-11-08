import { z } from 'zod';

export const createTariffSchema = z.object({
  serviceId: z.string().min(1),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

export const createTariffVersionSchema = z.object({
  tariffId: z.string().min(1),
  versionNumber: z.number().int().min(1),
  effectiveDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  tariffType: z.enum([
    'FLAT_RATE',
    'TIERED',
    'BLOCK',
    'TIME_OF_USE',
    'PEAK',
    'OFF_PEAK',
    'USAGE',
    'STANDING_CHARGE',
    'SEASONAL',
    'CUSTOM_RATE',
    'DISCOUNTED',
    'PERCENTAGE',
    'LATE_FEE',
    'MIN_CHARGE',
    'MAX_CHARGE',
    'TAX',
  ]),
  rules: z.record(z.string(), z.unknown()),
});

export type CreateTariffInput = z.infer<typeof createTariffSchema>;
export type CreateTariffVersionInput = z.infer<typeof createTariffVersionSchema>;
