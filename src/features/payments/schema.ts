import { z } from 'zod';

export const recordPaymentSchema = z.object({
  customerId: z.string().min(1),
  amount: z.number().min(0),
  currency: z.string().length(3),
  paymentMethod: z.string().max(50).optional(),
  paymentDate: z.coerce.date(),
  transactionId: z.string().max(100).optional(),
  idempotencyKey: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
  allocations: z
    .array(
      z.object({
        invoiceId: z.string().min(1),
        amount: z.number().min(0),
      }),
    )
    .optional(),
});

export const refundPaymentSchema = z.object({
  paymentId: z.string().min(1),
  amount: z.number().min(0),
  reason: z.string().max(500).optional(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>;
