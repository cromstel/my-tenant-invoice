import { z } from 'zod';

export const createPropertySchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().min(1).max(255),
  propertyType: z
    .enum([
      'RESIDENTIAL',
      'COMMERCIAL',
      'OFFICE',
      'RETAIL',
      'INDUSTRIAL',
      'PUBLIC',
      'EDUCATIONAL',
      'MIXED_USE',
      'OTHER',
    ])
    .optional(),
  portfolioId: z.string().optional(),
  owner: z.string().max(100).optional(),
  manager: z.string().max(100).optional(),
  unitCount: z.number().int().min(0).optional(),
});

export const createBuildingSchema = z.object({
  propertyId: z.string().min(1),
  name: z.string().min(1).max(100),
  address: z.string().max(255).optional(),
  floors: z.number().int().min(1).optional(),
  yearBuilt: z.number().int().min(1800).max(2100).optional(),
});

export const createUnitSchema = z.object({
  propertyId: z.string().min(1),
  buildingId: z.string().optional(),
  unitNumber: z.string().min(1).max(50),
  unitType: z
    .enum(['APARTMENT', 'HOUSE', 'CONDO', 'OFFICE_SPACE', 'RETAIL_SPACE', 'WAREHOUSE', 'OTHER'])
    .optional(),
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().min(0).optional(),
  squareFootage: z.number().int().min(0).optional(),
});

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type CreateBuildingInput = z.infer<typeof createBuildingSchema>;
export type CreateUnitInput = z.infer<typeof createUnitSchema>;
