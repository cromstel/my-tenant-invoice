import { Decimal } from 'decimal.js';

import { getCurrentUser } from '@/lib/auth';
import { NotFoundError } from '@/lib/errors';
import logger from '@/lib/logging/logger';
import { getActiveOrganizationId } from '@/lib/tenant';
import { repositories } from '@/server/repositories';

export interface RecordPaymentInput {
  customerId: string;
  amount: number;
  currency: string;
  paymentMethod?: string;
  paymentDate: Date;
  transactionId?: string;
  idempotencyKey?: string;
  notes?: string;
  allocations?: Array<{ invoiceId: string; amount: number }>;
}

export class PaymentService {
  private paymentRepo = repositories.payment;
  private allocationRepo = repositories.paymentAllocation;
  private invoiceRepo = repositories.invoice;
  private auditRepo = repositories.auditLog;

  async getById(id: string) {
    const payment = await this.paymentRepo.findById(id, { allocations: true, customer: true });
    if (!payment) throw new NotFoundError('Payment not found');
    return payment;
  }

  async list(orgId?: string, status?: string) {
    const organizationId = orgId ?? (await getActiveOrganizationId());
    const where: Record<string, unknown> = { organizationId };
    if (status) where.status = status;
    return this.paymentRepo.findAll(where);
  }

  async recordPayment(input: RecordPaymentInput) {
    const orgId = await getActiveOrganizationId();

    // Check idempotency
    if (input.idempotencyKey) {
      const existing = await this.paymentRepo.findFirst({ idempotencyKey: input.idempotencyKey });
      if (existing) return existing;
    }

    const payment = await this.paymentRepo.create({
      organizationId: orgId,
      customerId: input.customerId,
      transactionId: input.transactionId,
      paymentMethod: input.paymentMethod,
      amount: input.amount,
      currency: input.currency,
      paymentDate: input.paymentDate,
      status: 'SUCCEEDED',
      type: 'INVOICE_PAYMENT',
      notes: input.notes,
      idempotencyKey: input.idempotencyKey,
    });

    // Allocate to invoices
    if (input.allocations && input.allocations.length > 0) {
      for (const alloc of input.allocations) {
        await this.allocationRepo.create({
          paymentId: payment.id,
          invoiceId: alloc.invoiceId,
          amount: alloc.amount,
        });

        // Update invoice amount paid
        const invoice = await this.invoiceRepo.findById(alloc.invoiceId);
        if (invoice) {
          const newPaid = new Decimal(Number(invoice.amountPaid)).plus(alloc.amount);
          const newBalance = new Decimal(Number(invoice.total)).minus(newPaid);
          await this.invoiceRepo.update(alloc.invoiceId, {
            amountPaid: newPaid.toNumber(),
            remainingBalance: newBalance.toNumber(),
            status: newBalance.lte(0) ? 'PAID' : 'PARTIALLY_PAID',
          });
        }
      }
    }

    const user = await getCurrentUser();
    if (user) {
      await this.auditRepo.create({
        organizationId: orgId,
        actorId: user.id,
        action: 'payment.record',
        entityType: 'Payment',
        entityId: payment.id,
        metadata: {
          amount: input.amount,
          customerId: input.customerId,
          method: input.paymentMethod,
        },
      });
    }

    logger.info({ paymentId: payment.id, amount: input.amount }, 'Payment recorded');
    return payment;
  }

  async refund(paymentId: string, amount: number, reason?: string) {
    const payment = await this.getById(paymentId);
    const refund = await repositories.refund.create({
      paymentId,
      refundAmount: amount,
      reason,
    });

    // Update payment status
    await this.paymentRepo.update(paymentId, {
      status: amount >= Number(payment.amount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
    });

    const user = await getCurrentUser();
    if (user) {
      await this.auditRepo.create({
        organizationId: payment.organizationId,
        actorId: user.id,
        action: 'payment.refund',
        entityType: 'Payment',
        entityId: paymentId,
        metadata: { amount, reason },
      });
    }

    return refund;
  }

  async reconcile(paymentId: string, invoiceIds: string[]) {
    const payment = await this.getById(paymentId);
    const amount = new Decimal(Number(payment.amount));
    const perInvoice = amount.div(invoiceIds.length);

    for (const invoiceId of invoiceIds) {
      await this.allocationRepo.create({
        paymentId,
        invoiceId,
        amount: perInvoice.toNumber(),
      });

      const invoice = await this.invoiceRepo.findById(invoiceId);
      if (invoice) {
        const newPaid = new Decimal(Number(invoice.amountPaid)).plus(perInvoice);
        const newBalance = new Decimal(Number(invoice.total)).minus(newPaid);
        await this.invoiceRepo.update(invoiceId, {
          amountPaid: newPaid.toNumber(),
          remainingBalance: newBalance.toNumber(),
          status: newBalance.lte(0) ? 'PAID' : 'PARTIALLY_PAID',
        });
      }
    }
  }
}

export const paymentService = new PaymentService();
