import { Decimal } from 'decimal.js';

import { NotFoundError } from '@/lib/errors';
import { getActiveOrganizationId } from '@/lib/tenant';
import { repositories } from '@/server/repositories';

export interface ReportFilters {
  startDate?: Date;
  endDate?: Date;
  propertyId?: string;
  customerId?: string;
  serviceId?: string;
}

export class ReportService {
  private invoiceRepo = repositories.invoice;
  private customerRepo = repositories.customer;
  private propertyRepo = repositories.property;
  private meterRepo = repositories.meter;
  private readingRepo = repositories.meterReading;

  async getRevenueReport(filters: ReportFilters) {
    const orgId = await getActiveOrganizationId();
    const invoices = await this.invoiceRepo.findAll({ organizationId: orgId });

    const filtered = invoices.filter((inv: { invoiceDate: Date }) => {
      const d = new Date(inv.invoiceDate);
      if (filters.startDate && d < filters.startDate) return false;
      if (filters.endDate && d > filters.endDate) return false;
      return true;
    });

    const totalBilled = filtered.reduce(
      (sum: number, inv: { total: unknown }) => sum + Number(inv.total),
      0,
    );
    const totalCollected = filtered.reduce(
      (sum: number, inv: { amountPaid: unknown }) => sum + Number(inv.amountPaid),
      0,
    );
    const totalOutstanding = filtered.reduce(
      (sum: number, inv: { remainingBalance: unknown }) => sum + Number(inv.remainingBalance),
      0,
    );

    return {
      totalBilled,
      totalCollected,
      totalOutstanding,
      collectionRate: totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0,
      invoiceCount: filtered.length,
      invoices: filtered,
    };
  }

  async getAgingReport() {
    const orgId = await getActiveOrganizationId();
    const invoices = await this.invoiceRepo.findAll({
      organizationId: orgId,
      status: { not: 'PAID' },
    });

    const now = new Date();
    const buckets = {
      current: 0,
      '1-30': 0,
      '31-60': 0,
      '61-90': 0,
      '90+': 0,
    };

    for (const inv of invoices) {
      const dueDate = new Date(inv.dueDate as Date);
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const balance = Number(inv.remainingBalance);

      if (daysOverdue <= 0) buckets.current += balance;
      else if (daysOverdue <= 30) buckets['1-30'] += balance;
      else if (daysOverdue <= 60) buckets['31-60'] += balance;
      else if (daysOverdue <= 90) buckets['61-90'] += balance;
      else buckets['90+'] += balance;
    }

    return { buckets, totalOutstanding: Object.values(buckets).reduce((a, b) => a + b, 0) };
  }

  async getConsumptionReport(meterId: string, startDate: Date, endDate: Date) {
    const meter = await this.meterRepo.findById(meterId);
    if (!meter) throw new NotFoundError('Meter not found');

    const readings = await this.readingRepo.findAll({ meterId });
    const filtered = readings.filter((r: { readingDate: Date }) => {
      const d = new Date(r.readingDate);
      return d >= startDate && d <= endDate;
    });

    if (filtered.length < 2) return { consumption: 0, readings: filtered, averageDaily: 0 };

    const firstReading = filtered[0];
    const lastReading = filtered[filtered.length - 1];
    if (!firstReading || !lastReading)
      return { consumption: 0, readings: filtered, averageDaily: 0 };

    const first = new Decimal(Number(firstReading.reading));
    const last = new Decimal(Number(lastReading.reading));
    const consumption = last.minus(first).mul(new Decimal(Number(meter.multiplier)));
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    return {
      consumption: consumption.toNumber(),
      readings: filtered,
      averageDaily: days > 0 ? consumption.div(days).toNumber() : 0,
      meterType: meter.meterType,
      unitOfMeasurement: meter.unitOfMeasurement,
    };
  }

  async getOccupancyReport() {
    const orgId = await getActiveOrganizationId();
    const properties = await this.propertyRepo.findAll({ organizationId: orgId });
    const units = await repositories.unit.findAll({ organizationId: orgId });

    const totalUnits = units.length;
    const occupiedUnits = units.filter(
      (u: { occupancyStatus: string }) => u.occupancyStatus === 'OCCUPIED',
    ).length;
    const vacantUnits = units.filter(
      (u: { occupancyStatus: string }) => u.occupancyStatus === 'VACANT',
    ).length;

    return {
      totalProperties: properties.length,
      totalUnits,
      occupiedUnits,
      vacantUnits,
      occupancyRate: totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0,
    };
  }

  async getCustomerReport(customerId: string) {
    const customer = await this.customerRepo.findById(customerId);
    if (!customer) throw new NotFoundError('Customer not found');

    const invoices = await this.invoiceRepo.findAll({ customerId });
    const payments = await repositories.payment.findAll({ customerId });

    const totalBilled = invoices.reduce(
      (sum: number, inv: { total: unknown }) => sum + Number(inv.total),
      0,
    );
    const totalPaid = payments.reduce(
      (sum: number, p: { amount: unknown }) => sum + Number(p.amount),
      0,
    );

    return {
      customer,
      totalBilled,
      totalPaid,
      balance: totalBilled - totalPaid,
      invoiceCount: invoices.length,
      paymentCount: payments.length,
      lastPayment: payments.length > 0 ? payments[payments.length - 1] : null,
    };
  }
}

export const reportService = new ReportService();
