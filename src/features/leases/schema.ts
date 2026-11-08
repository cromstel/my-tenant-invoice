import { z } from 'zod';

export const createLeaseSchema = z.object({
  customerId: z.string().min(1),
  unitId: z.string().min(1),
  propertyId: z.string().optional(),
  leaseNumber: z.string().max(50).optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  moveInDate: z.coerce.date(),
  moveOutDate: z.coerce.date().optional(),
  billingStartDate: z.coerce.date().optional(),
  billingEndDate: z.coerce.date().optional(),
  depositAmount: z.number().min(0).optional(),
  recurringCharge: z.number().min(0).optional(),
  serviceAgreement: z.record(z.string(), z.unknown()).optional(),
});

export const terminateLeaseSchema = z.object({
  leaseId: z.string().min(1),
  moveOutDate: z.coerce.date(),
});

export const renewLeaseSchema = z.object({
  leaseId: z.string().min(1),
  newEndDate: z.coerce.date(),
  newRecurringCharge: z.number().min(0).optional(),
});

export type CreateLeaseInput = z.infer<typeof createLeaseSchema>;
export type TerminateLeaseInput = z.infer<typeof terminateLeaseSchema>;
export type RenewLeaseInput = z.infer<typeof renewLeaseSchema>;
