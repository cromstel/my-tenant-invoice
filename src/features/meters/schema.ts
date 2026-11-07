import { z } from 'zod';

export const createMeterSchema = z.object({
  propertyId: z.string().min(1),
  unitId: z.string().optional(),
  tariffId: z.string().optional(),
  serialNumber: z.string().min(1).max(50),
  meterType: z.enum(['ELECTRICITY', 'WATER', 'GAS', 'HEAT', 'COOLING', 'CUSTOM']).optional(),
  unitOfMeasurement: z.string().min(1).max(10),
  installationDate: z.coerce.date(),
  removalDate: z.coerce.date().optional(),
  multiplier: z.number().min(0).optional(),
  openingReading: z.number().min(0).optional(),
});

export const createMeterReadingSchema = z.object({
  meterId: z.string().min(1),
  reading: z.number().min(0),
  readingDate: z.coerce.date(),
  readingType: z
    .enum(['MANUAL', 'IMPORT', 'API', 'SMART_METER', 'ESTIMATED', 'CORRECTED'])
    .optional(),
  isEstimated: z.boolean().optional(),
  notes: z.string().max(500).optional(),
});

export type CreateMeterInput = z.infer<typeof createMeterSchema>;
export type CreateMeterReadingInput = z.infer<typeof createMeterReadingSchema>;
