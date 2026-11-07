'use server';

import { revalidatePath } from 'next/cache';

import { requirePermission } from '@/lib/auth';
import { services } from '@/server/services';

import {
  type CreateMeterInput,
  type CreateMeterReadingInput,
  createMeterReadingSchema,
  createMeterSchema,
} from './schema';

export async function createMeterAction(input: CreateMeterInput) {
  await requirePermission('meter.create');
  const validated = createMeterSchema.parse(input);
  const meter = await services.meter.create(validated);
  revalidatePath('/dashboard/meters');
  return meter;
}

export async function addMeterReadingAction(input: CreateMeterReadingInput) {
  await requirePermission('meter.create');
  const validated = createMeterReadingSchema.parse(input);
  const result = await services.meter.addReading(validated);
  revalidatePath('/dashboard/meters');
  return result;
}

export async function updateMeterStatusAction(id: string, status: string) {
  await requirePermission('meter.update');
  const meter = await services.meter.updateStatus(id, status);
  revalidatePath('/dashboard/meters');
  return meter;
}
