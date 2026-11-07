import { z } from 'zod';

export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).optional(),
  billingEmail: z.string().email().optional(),
  contactEmail: z.string().email().optional(),
  phoneNumber: z.string().max(20).optional(),
  address: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  zipCode: z.string().max(20).optional(),
  country: z.string().max(100).optional(),
  taxId: z.string().max(50).optional(),
  currency: z.string().length(3).optional(),
  locale: z.string().max(10).optional(),
  timezone: z.string().max(50).optional(),
});

export const updateOrganizationSchema = createOrganizationSchema.partial();

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
