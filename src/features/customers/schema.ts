import { z } from 'zod';

export const createCustomerSchema = z.object({
  type: z.enum(['INDIVIDUAL', 'COMPANY']).optional(),
  companyName: z.string().max(100).optional(),
  firstName: z.string().max(50).optional(),
  lastName: z.string().max(50).optional(),
  fullName: z.string().max(100).optional(),
  email: z.string().email().optional(),
  phoneNumber: z.string().max(20).optional(),
  billingAddress: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  zipCode: z.string().max(20).optional(),
  country: z.string().max(100).optional(),
  taxVatNumber: z.string().max(50).optional(),
  internalNotes: z.string().max(1000).optional(),
  propertyId: z.string().optional(),
});

export const createCustomerContactSchema = z.object({
  customerId: z.string().min(1),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  email: z.string().email(),
  phoneNumber: z.string().max(20).optional(),
  isPrimary: z.boolean().optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type CreateCustomerContactInput = z.infer<typeof createCustomerContactSchema>;
