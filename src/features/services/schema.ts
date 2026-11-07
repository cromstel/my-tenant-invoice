import { z } from 'zod';

export const createServiceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  serviceType: z
    .enum([
      'RENT',
      'ELECTRICITY',
      'WATER',
      'GAS',
      'HEATING',
      'COOLING',
      'INTERNET',
      'WASTE',
      'PARKING',
      'MAINTENANCE',
      'SERVICE_CHARGE',
      'CLEANING',
      'SECURITY',
      'CUSTOM_SERVICE',
    ])
    .optional(),
  isBillable: z.boolean().optional(),
  defaultPrice: z.number().min(0).optional(),
});

export const createServicePackageSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  items: z.array(
    z.object({
      serviceId: z.string().min(1),
      quantity: z.number().int().min(1),
      unitPrice: z.number().min(0),
    }),
  ),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type CreateServicePackageInput = z.infer<typeof createServicePackageSchema>;
