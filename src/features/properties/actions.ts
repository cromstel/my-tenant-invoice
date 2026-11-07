'use server';

import { revalidatePath } from 'next/cache';

import { requirePermission } from '@/lib/auth';
import { services } from '@/server/services';

import {
  type CreateBuildingInput,
  createBuildingSchema,
  type CreatePropertyInput,
  createPropertySchema,
  type CreateUnitInput,
  createUnitSchema,
} from './schema';

export async function createPropertyAction(input: CreatePropertyInput) {
  await requirePermission('property.create');
  const validated = createPropertySchema.parse(input);
  const property = await services.property.createProperty(validated);
  revalidatePath('/dashboard/properties');
  return property;
}

export async function updatePropertyAction(id: string, input: Partial<CreatePropertyInput>) {
  await requirePermission('property.update');
  const property = await services.property.updateProperty(id, input);
  revalidatePath('/dashboard/properties');
  return property;
}

export async function deletePropertyAction(id: string) {
  await requirePermission('property.delete');
  await services.property.deleteProperty(id);
  revalidatePath('/dashboard/properties');
}

export async function createBuildingAction(input: CreateBuildingInput) {
  await requirePermission('property.create');
  const validated = createBuildingSchema.parse(input);
  const building = await services.property.createBuilding(validated);
  revalidatePath('/dashboard/properties');
  return building;
}

export async function createUnitAction(input: CreateUnitInput) {
  await requirePermission('property.create');
  const validated = createUnitSchema.parse(input);
  const unit = await services.property.createUnit(validated);
  revalidatePath('/dashboard/properties');
  return unit;
}
