import { Decimal } from 'decimal.js';

import { getCurrentUser } from '@/lib/auth';
import { NotFoundError } from '@/lib/errors';
import logger from '@/lib/logging/logger';
import { getActiveOrganizationId } from '@/lib/tenant';
import { repositories } from '@/server/repositories';

export interface CreateInvoiceInput {
  customerId: string;
  billingCycleId?: string;
  leaseId?: string;
  invoiceDate: Date;
  dueDate: Date;
  currency?: string;
  notes?: string;
  termsAndConditions?: string;
  paymentInstructions?: string;
  items: Array<{
    serviceId: string;
    tariffVersionId?: string;
    meterId?: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    taxRate?: number;
    isProrated?: boolean;
    billingPeriodStart?: Date;
    billingPeriodEnd?: Date;
  }>;
}

export class InvoiceService {
  private invoiceRepo = repositories.invoice;
  private invoiceItemRepo = repositories.invoiceItem;
  private customerRepo = repositories.customer;
  private orgRepo = repositories.organization;
  private auditRepo = repositories.auditLog;

  async getById(id: string) {
    const invoice = await this.invoiceRepo.findById(id, {
      items: { include: { service: true, tariffVersion: true, meter: true } },
      customer: true,
    });
    if (!invoice) throw new NotFoundError('Invoice not found');
    return invoice;
  }

  async list(orgId?: string, status?: string) {
    const organizationId = orgId ?? (await getActiveOrganizationId());
    const where: Record<string, unknown> = { organizationId };
    if (status) where.status = status;
    return this.invoiceRepo.findAll(where);
  }

  async create(input: CreateInvoiceInput) {
    const orgId = await getActiveOrganizationId();
    const customer = await this.customerRepo.findById(input.customerId);
    if (!customer) throw new NotFoundError('Customer not found');

    const org = await this.orgRepo.findById(orgId);
    if (!org) throw new NotFoundError('Organization not found');

    const invoiceNumber = `${org.invoicePrefix ?? 'INV-'}${String(org.nextInvoiceNumber ?? 1).padStart(6, '0')}`;

    // Calculate totals
    let subtotal = new Decimal(0);
    let taxAmount = new Decimal(0);

    const items = input.items.map((item) => {
      const quantity = new Decimal(item.quantity);
      const unitPrice = new Decimal(item.unitPrice);
      const amount = quantity.mul(unitPrice);
      const taxRate = new Decimal(item.taxRate ?? 0);
      const itemTax = amount.mul(taxRate);
      subtotal = subtotal.plus(amount);
      taxAmount = taxAmount.plus(itemTax);
      return {
        serviceId: item.serviceId,
        tariffVersionId: item.tariffVersionId,
        meterId: item.meterId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: amount.toNumber(),
        taxRate: item.taxRate ?? 0,
        taxAmount: itemTax.toNumber(),
        isProrated: item.isProrated ?? false,
        billingPeriodStart: item.billingPeriodStart,
        billingPeriodEnd: item.billingPeriodEnd,
      };
    });

    const total = subtotal.plus(taxAmount);

    const invoice = await this.invoiceRepo.create({
      organizationId: orgId,
      customerId: input.customerId,
      billingCycleId: input.billingCycleId,
      leaseId: input.leaseId,
      invoiceNumber,
      status: 'DRAFT',
      invoiceDate: input.invoiceDate,
      dueDate: input.dueDate,
      currency: input.currency ?? org.currency,
      subtotal: subtotal.toNumber(),
      discountAmount: 0,
      taxAmount: taxAmount.toNumber(),
      total: total.toNumber(),
      amountPaid: 0,
      remainingBalance: total.toNumber(),
      notes: input.notes,
      termsAndConditions: input.termsAndConditions,
      paymentInstructions: input.paymentInstructions,
    });

    // Create invoice items
    for (const item of items) {
      await this.invoiceItemRepo.create({
        invoiceId: invoice.id,
        serviceId: item.serviceId,
        tariffVersionId: item.tariffVersionId,
        meterId: item.meterId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
        taxRate: item.taxRate,
        taxAmount: item.taxAmount,
        isProrated: item.isProrated,
        billingPeriodStart: item.billingPeriodStart,
        billingPeriodEnd: item.billingPeriodEnd,
      });
    }

    // Increment invoice number
    await this.orgRepo.update(orgId, { nextInvoiceNumber: (org.nextInvoiceNumber ?? 1) + 1 });

    const user = await getCurrentUser();
    if (user) {
      await this.auditRepo.create({
        organizationId: orgId,
        actorId: user.id,
        action: 'invoice.create',
        entityType: 'Invoice',
        entityId: invoice.id,
        metadata: { invoiceNumber, customerId: input.customerId, total: total.toNumber() },
      });
    }

    logger.info(
      { invoiceId: invoice.id, invoiceNumber, total: total.toNumber() },
      'Invoice created',
    );
    return this.getById(invoice.id);
  }

  async updateStatus(id: string, status: string) {
    const invoice = await this.getById(id);
    const updated = await this.invoiceRepo.update(id, { status });

    const user = await getCurrentUser();
    if (user) {
      await this.auditRepo.create({
        organizationId: invoice.organizationId,
        actorId: user.id,
        action: `invoice.status.${status.toLowerCase()}`,
        entityType: 'Invoice',
        entityId: id,
        metadata: { from: invoice.status, to: status },
      });
    }

    return updated;
  }

  async approve(id: string) {
    return this.updateStatus(id, 'APPROVED');
  }

  async send(id: string) {
    const invoice = await this.getById(id);
    const updated = await this.updateStatus(id, 'SENT');
    // Here we would trigger email sending via notification service
    logger.info({ invoiceId: id, invoiceNumber: invoice.invoiceNumber }, 'Invoice sent');
    return updated;
  }

  async voidInvoice(id: string, reason?: string) {
    const invoice = await this.getById(id);
    if (invoice.status === 'PAID') throw new Error('Cannot void a paid invoice');
    const updated = await this.updateStatus(id, 'VOID');

    const user = await getCurrentUser();
    if (user) {
      await this.auditRepo.create({
        organizationId: invoice.organizationId,
        actorId: user.id,
        action: 'invoice.void',
        entityType: 'Invoice',
        entityId: id,
        metadata: { reason },
      });
    }

    return updated;
  }

  async cancel(id: string, reason?: string) {
    const invoice = await this.getById(id);
    const updated = await this.updateStatus(id, 'CANCELLED');

    const user = await getCurrentUser();
    if (user) {
      await this.auditRepo.create({
        organizationId: invoice.organizationId,
        actorId: user.id,
        action: 'invoice.cancel',
        entityType: 'Invoice',
        entityId: id,
        metadata: { reason },
      });
    }

    return updated;
  }

  async delete(id: string) {
    const invoice = await this.getById(id);
    if (invoice.status !== 'DRAFT') throw new Error('Only draft invoices can be deleted');
    await this.invoiceRepo.delete(id);
  }
}

export const invoiceService = new InvoiceService();
