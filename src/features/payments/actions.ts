'use server';

import { revalidatePath } from 'next/cache';

import { requirePermission } from '@/lib/auth';
import { services } from '@/server/services';

import {
  type RecordPaymentInput,
  recordPaymentSchema,
  type RefundPaymentInput,
  refundPaymentSchema,
} from './schema';

export async function recordPaymentAction(input: RecordPaymentInput) {
  await requirePermission('payment.record');
  const validated = recordPaymentSchema.parse(input);
  const payment = await services.payment.recordPayment(validated);
  revalidatePath('/dashboard/payments');
  return payment;
}

export async function refundPaymentAction(input: RefundPaymentInput) {
  await requirePermission('payment.refund');
  const validated = refundPaymentSchema.parse(input);
  const refund = await services.payment.refund(
    validated.paymentId,
    validated.amount,
    validated.reason,
  );
  revalidatePath('/dashboard/payments');
  return refund;
}
