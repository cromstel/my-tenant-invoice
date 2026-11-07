import { z } from 'zod';

export const reportFiltersSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  propertyId: z.string().optional(),
  customerId: z.string().optional(),
  serviceId: z.string().optional(),
});

export const reportTypeSchema = z.enum([
  'revenue',
  'aging',
  'consumption',
  'occupancy',
  'customer',
]);

export type ReportFiltersInput = z.infer<typeof reportFiltersSchema>;
export type ReportType = z.infer<typeof reportTypeSchema>;
