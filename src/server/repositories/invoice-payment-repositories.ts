import type { Prisma } from '@prisma/client';

import prisma from '@/lib/db/prisma';

import { BaseRepository } from './base-repository';

// --- Invoices ---
export class InvoiceRepository extends BaseRepository<
  Prisma.InvoiceDelegate,
  Prisma.InvoiceGetPayload<{ include: { items: true; customer: true } }>
> {
  protected get delegate() {
    return prisma.invoice;
  }

  async findByNumber(invoiceNumber: string) {
    return this.findFirst({ invoiceNumber });
  }

  async getNextInvoiceNumber(organizationId: string): Promise<string> {
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new Error('Organization not found');
    const next = org.nextInvoiceNumber ?? 1;
    return `${org.invoicePrefix ?? 'INV'}-${String(next).padStart(6, '0')}`;
  }
}

export class InvoiceItemRepository extends BaseRepository<
  Prisma.InvoiceItemDelegate,
  Prisma.InvoiceItemGetPayload<object>
> {
  protected get delegate() {
    return prisma.invoiceItem;
  }
}

// --- Credit Notes ---
export class CreditNoteRepository extends BaseRepository<
  Prisma.CreditNoteDelegate,
  Prisma.CreditNoteGetPayload<{ include: { items: true } }>
> {
  protected get delegate() {
    return prisma.creditNote;
  }
}

export class CreditNoteItemRepository extends BaseRepository<
  Prisma.CreditNoteItemDelegate,
  Prisma.CreditNoteItemGetPayload<object>
> {
  protected get delegate() {
    return prisma.creditNoteItem;
  }
}

// --- Payments ---
export class PaymentRepository extends BaseRepository<
  Prisma.PaymentDelegate,
  Prisma.PaymentGetPayload<{ include: { allocations: true } }>
> {
  protected get delegate() {
    return prisma.payment;
  }

  async findByStripePaymentIntentId(stripePaymentIntentId: string) {
    return this.findFirst({ stripePaymentIntentId });
  }
}

export class PaymentAllocationRepository extends BaseRepository<
  Prisma.PaymentAllocationDelegate,
  Prisma.PaymentAllocationGetPayload<object>
> {
  protected get delegate() {
    return prisma.paymentAllocation;
  }
}

export class RefundRepository extends BaseRepository<
  Prisma.RefundDelegate,
  Prisma.RefundGetPayload<object>
> {
  protected get delegate() {
    return prisma.refund;
  }
}
