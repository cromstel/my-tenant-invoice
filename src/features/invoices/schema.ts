import { z } from 'zod';

export const createInvoiceItemSchema = z.object({
  serviceId: z.string().min(1),
  tariffVersionId: z.string().optional(),
  meterId: z.string().optional(),
  description: z.string().max(255).optional(),
  quantity: z.number().min(0),
  unitPrice: z.number().min(0),
  taxRate: z.number().min(0).max(1).optional(),
  isProrated: z.boolean().optional(),
  billingPeriodStart: z.coerce.date().optional(),
  billingPeriodEnd: z.coerce.date().optional(),
});

export const createInvoiceSchema = z.object({
  customerId: z.string().min(1),
  billingCycleId: z.string().optional(),
  leaseId: z.string().optional(),
  invoiceDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  currency: z.string().length(3).optional(),
  notes: z.string().max(1000).optional(),
  termsAndConditions: z.string().max(2000).optional(),
  paymentInstructions: z.string().max(500).optional(),
  items: z.array(createInvoiceItemSchema).min(1),
});

export const updateInvoiceStatusSchema = z.object({
  status: z.enum([
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED',
    'SENT',
    'VIEWED',
    'PARTIALLY_PAID',
    'PAID',
    'OVERDUE',
    'VOID',
    'CANCELLED',
    'REFUNDED',
  ]),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type CreateInvoiceItemInput = z.infer<typeof createInvoiceItemSchema>;
export type UpdateInvoiceStatusInput = z.infer<typeof updateInvoiceStatusSchema>;
