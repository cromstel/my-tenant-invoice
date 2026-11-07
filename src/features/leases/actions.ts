'use server';

import { revalidatePath } from 'next/cache';

import { requirePermission } from '@/lib/auth';
import { services } from '@/server/services';

import {
  type CreateLeaseInput,
  createLeaseSchema,
  type RenewLeaseInput,
  renewLeaseSchema,
  type TerminateLeaseInput,
  terminateLeaseSchema,
} from './schema';

export async function createLeaseAction(input: CreateLeaseInput) {
  await requirePermission('lease.create');
  const validated = createLeaseSchema.parse(input);
  const lease = await services.lease.create(validated);
  revalidatePath('/dashboard/leases');
  return lease;
}

export async function terminateLeaseAction(input: TerminateLeaseInput) {
  await requirePermission('lease.update');
  const validated = terminateLeaseSchema.parse(input);
  const lease = await services.lease.terminate(validated.leaseId, validated.moveOutDate);
  revalidatePath('/dashboard/leases');
  return lease;
}

export async function renewLeaseAction(input: RenewLeaseInput) {
  await requirePermission('lease.update');
  const validated = renewLeaseSchema.parse(input);
  const lease = await services.lease.renew(
    validated.leaseId,
    validated.newEndDate,
    validated.newRecurringCharge,
  );
  revalidatePath('/dashboard/leases');
  return lease;
}
