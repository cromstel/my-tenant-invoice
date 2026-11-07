import { Decimal } from 'decimal.js';

import { getCurrentUser } from '@/lib/auth';
import logger from '@/lib/logging/logger';
import { repositories } from '@/server/repositories';

import { invoiceService } from './invoice-service';
import { leaseService } from './lease-service';
import { meterService } from './meter-service';
import { tariffService } from './tariff-service';

export interface GenerateInvoiceFromLeaseInput {
  leaseId: string;
  invoiceDate: Date;
  dueDate: Date;
  includeServices?: boolean;
  includeMeterCharges?: boolean;
  billingPeriodStart?: Date;
  billingPeriodEnd?: Date;
}

export class BillingService {
  private serviceRepo = repositories.service;
  private tariffRepo = repositories.tariff;
  private meterRepo = repositories.meter;
  private auditRepo = repositories.auditLog;

  async generateInvoiceFromLease(input: GenerateInvoiceFromLeaseInput) {
    const lease = await leaseService.getById(input.leaseId);
    const orgId = lease.organizationId;

    const items: Array<{
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
    }> = [];

    // Add recurring charge (rent)
    if (lease.recurringCharge && Number(lease.recurringCharge) > 0) {
      const services = await this.serviceRepo.findAll({
        organizationId: orgId,
        serviceType: 'RENT',
      });
      const rentService = services[0];
      if (rentService) {
        items.push({
          serviceId: rentService.id,
          description: `Rent - ${input.billingPeriodStart?.toLocaleDateString() ?? ''} to ${input.billingPeriodEnd?.toLocaleDateString() ?? ''}`,
          quantity: 1,
          unitPrice: Number(lease.recurringCharge),
          taxRate: 0,
          isProrated: false,
          billingPeriodStart: input.billingPeriodStart,
          billingPeriodEnd: input.billingPeriodEnd,
        });
      }
    }

    // Add meter charges
    if (input.includeMeterCharges) {
      const meters = await this.meterRepo.findAll({ organizationId: orgId, unitId: lease.unitId });
      for (const meter of meters) {
        if (!meter.tariffId) continue;
        const tariff = await this.tariffRepo.findById(meter.tariffId, { versions: true });
        if (!tariff || !tariff.versions?.length) continue;

        const activeVersion = tariff.versions?.[0];
        if (!activeVersion) continue;
        const consumption = await meterService.getConsumption(
          meter.id,
          input.billingPeriodStart ??
            new Date(input.invoiceDate.getTime() - 30 * 24 * 60 * 60 * 1000),
          input.billingPeriodEnd ?? input.invoiceDate,
        );

        const charge = tariffService.calculateCharge({
          tariffType: activeVersion.tariffType,
          rules: activeVersion.rules as Record<string, unknown>,
          quantity: consumption.consumption,
          unitPrice: 0,
        });

        if (charge > 0) {
          items.push({
            serviceId: tariff.serviceId,
            tariffVersionId: activeVersion.id,
            meterId: meter.id,
            description: `${meter.meterType} consumption - ${consumption.consumption} ${meter.unitOfMeasurement}`,
            quantity: consumption.consumption,
            unitPrice: charge / consumption.consumption || 0,
            taxRate: 0,
            isProrated: false,
            billingPeriodStart: input.billingPeriodStart,
            billingPeriodEnd: input.billingPeriodEnd,
          });
        }
      }
    }

    if (items.length === 0) {
      throw new Error('No billable items found for this lease');
    }

    const invoice = await invoiceService.create({
      customerId: lease.customerId,
      leaseId: input.leaseId,
      invoiceDate: input.invoiceDate,
      dueDate: input.dueDate,
      currency: (await repositories.organization.findById(orgId))?.currency ?? 'USD',
      items,
    });

    const user = await getCurrentUser();
    if (user) {
      await this.auditRepo.create({
        organizationId: orgId,
        actorId: user.id,
        action: 'billing.generate_invoice',
        entityType: 'Invoice',
        entityId: invoice.id,
        metadata: { leaseId: input.leaseId, itemCount: items.length },
      });
    }

    logger.info(
      { invoiceId: invoice.id, leaseId: input.leaseId, itemCount: items.length },
      'Invoice generated from lease',
    );
    return invoice;
  }

  async calculateLateFee(invoiceId: string, lateFeeRate: number, gracePeriodDays: number) {
    const invoice = await invoiceService.getById(invoiceId);
    const dueDate = new Date(invoice.dueDate as Date);
    const now = new Date();
    const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysOverdue <= gracePeriodDays) return 0;

    const balance = new Decimal(Number(invoice.remainingBalance));
    const lateFee = balance.mul(new Decimal(lateFeeRate).div(100));
    return lateFee.toNumber();
  }

  async applyDiscount(invoiceId: string, discountAmount: number, reason?: string) {
    const invoice = await invoiceService.getById(invoiceId);
    const newSubtotal = new Decimal(Number(invoice.subtotal)).minus(discountAmount);
    const newTotal = newSubtotal.plus(new Decimal(Number(invoice.taxAmount)));
    const newBalance = newTotal.minus(new Decimal(Number(invoice.amountPaid)));

    const updated = await repositories.invoice.update(invoiceId, {
      discountAmount,
      subtotal: newSubtotal.toNumber(),
      total: newTotal.toNumber(),
      remainingBalance: newBalance.toNumber(),
    });

    const user = await getCurrentUser();
    if (user) {
      await this.auditRepo.create({
        organizationId: invoice.organizationId,
        actorId: user.id,
        action: 'billing.apply_discount',
        entityType: 'Invoice',
        entityId: invoiceId,
        metadata: { discountAmount, reason },
      });
    }

    return updated;
  }
}

export const billingService = new BillingService();
