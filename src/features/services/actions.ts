'use server';

import { revalidatePath } from 'next/cache';

import { requirePermission } from '@/lib/auth';
import { services } from '@/server/services';

import {
  type CreateServiceInput,
  type CreateServicePackageInput,
  createServicePackageSchema,
  createServiceSchema,
} from './schema';

export async function createServiceAction(input: CreateServiceInput) {
  await requirePermission('service.create');
  const validated = createServiceSchema.parse(input);
  const service = await services.service.create(validated);
  revalidatePath('/dashboard/services');
  return service;
}

export async function updateServiceAction(id: string, input: Partial<CreateServiceInput>) {
  await requirePermission('service.update');
  const service = await services.service.update(id, input);
  revalidatePath('/dashboard/services');
  return service;
}

export async function deleteServiceAction(id: string) {
  await requirePermission('service.delete');
  await services.service.delete(id);
  revalidatePath('/dashboard/services');
}

export async function createServicePackageAction(input: CreateServicePackageInput) {
  await requirePermission('service.create');
  const validated = createServicePackageSchema.parse(input);
  const pkg = await services.service.createPackage(validated);
  revalidatePath('/dashboard/services');
  return pkg;
}
