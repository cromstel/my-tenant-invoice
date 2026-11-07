'use server';

import { revalidatePath } from 'next/cache';

import { requirePermission } from '@/lib/auth';
import { services } from '@/server/services';

import {
  type CreateCustomerContactInput,
  createCustomerContactSchema,
  type CreateCustomerInput,
  createCustomerSchema,
} from './schema';

export async function createCustomerAction(input: CreateCustomerInput) {
  await requirePermission('customer.create');
  const validated = createCustomerSchema.parse(input);
  const customer = await services.customer.create(validated);
  revalidatePath('/dashboard/customers');
  return customer;
}

export async function updateCustomerAction(id: string, input: Partial<CreateCustomerInput>) {
  await requirePermission('customer.update');
  const customer = await services.customer.update(id, input);
  revalidatePath('/dashboard/customers');
  return customer;
}

export async function deleteCustomerAction(id: string) {
  await requirePermission('customer.delete');
  await services.customer.delete(id);
  revalidatePath('/dashboard/customers');
}

export async function addCustomerContactAction(input: CreateCustomerContactInput) {
  await requirePermission('customer.update');
  const validated = createCustomerContactSchema.parse(input);
  const contact = await services.customer.addContact(validated);
  revalidatePath('/dashboard/customers');
  return contact;
}
