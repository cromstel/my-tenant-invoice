'use server';

import { revalidatePath } from 'next/cache';

import { requirePermission } from '@/lib/auth';
import { services } from '@/server/services';

import {
  type CreateTariffInput,
  createTariffSchema,
  type CreateTariffVersionInput,
  createTariffVersionSchema,
} from './schema';

export async function createTariffAction(input: CreateTariffInput) {
  await requirePermission('tariff.create');
  const validated = createTariffSchema.parse(input);
  const tariff = await services.tariff.create(validated);
  revalidatePath('/dashboard/tariffs');
  return tariff;
}

export async function createTariffVersionAction(input: CreateTariffVersionInput) {
  await requirePermission('tariff.create');
  const validated = createTariffVersionSchema.parse(input);
  const version = await services.tariff.createVersion(validated);
  revalidatePath('/dashboard/tariffs');
  return version;
}
