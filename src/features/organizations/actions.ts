'use server';

import { revalidatePath } from 'next/cache';

import { requirePermission } from '@/lib/auth';
import { services } from '@/server/services';

import {
  type CreateOrganizationInput,
  createOrganizationSchema,
  type UpdateOrganizationInput,
  updateOrganizationSchema,
} from './schema';

export async function createOrganizationAction(input: CreateOrganizationInput) {
  await requirePermission('org.create');
  const validated = createOrganizationSchema.parse(input);
  const org = await services.organization.create(validated);
  revalidatePath('/dashboard/settings');
  return org;
}

export async function updateOrganizationAction(id: string, input: UpdateOrganizationInput) {
  await requirePermission('org.update');
  const validated = updateOrganizationSchema.parse(input);
  const org = await services.organization.update(id, validated);
  revalidatePath('/dashboard/settings');
  return org;
}

export async function deleteOrganizationAction(id: string) {
  await requirePermission('org.delete');
  await services.organization.delete(id);
  revalidatePath('/dashboard');
}
