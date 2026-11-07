'use server';

import { revalidatePath } from 'next/cache';

import { requirePermission } from '@/lib/auth';
import { services } from '@/server/services';

import { type CreateInvoiceInput, createInvoiceSchema } from './schema';

export async function createInvoiceAction(input: CreateInvoiceInput) {
  await requirePermission('invoice.create');
  const validated = createInvoiceSchema.parse(input);
  const invoice = await services.invoice.create(validated);
  revalidatePath('/dashboard/invoices');
  return invoice;
}

export async function approveInvoiceAction(id: string) {
  await requirePermission('invoice.approve');
  const invoice = await services.invoice.approve(id);
  revalidatePath('/dashboard/invoices');
  return invoice;
}

export async function sendInvoiceAction(id: string) {
  await requirePermission('invoice.send');
  const invoice = await services.invoice.send(id);
  revalidatePath('/dashboard/invoices');
  return invoice;
}

export async function voidInvoiceAction(id: string, reason?: string) {
  await requirePermission('invoice.void');
  const invoice = await services.invoice.voidInvoice(id, reason);
  revalidatePath('/dashboard/invoices');
  return invoice;
}

export async function cancelInvoiceAction(id: string, reason?: string) {
  await requirePermission('invoice.cancel');
  const invoice = await services.invoice.cancel(id, reason);
  revalidatePath('/dashboard/invoices');
  return invoice;
}

export async function deleteInvoiceAction(id: string) {
  await requirePermission('invoice.delete');
  await services.invoice.delete(id);
  revalidatePath('/dashboard/invoices');
}
