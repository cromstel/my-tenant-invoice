import { Decimal } from 'decimal.js';

import { getCurrentUser } from '@/lib/auth';
import { NotFoundError } from '@/lib/errors';
import logger from '@/lib/logging/logger';
import { getActiveOrganizationId } from '@/lib/tenant';
import { repositories } from '@/server/repositories';

export interface CreateLeaseInput {
  customerId: string;
  unitId: string;
  propertyId?: string;
  leaseNumber?: string;
  startDate: Date;
  endDate?: Date;
  moveInDate: Date;
  moveOutDate?: Date;
  billingStartDate?: Date;
  billingEndDate?: Date;
  depositAmount?: number;
  recurringCharge?: number;
  serviceAgreement?: Record<string, unknown>;
}

export class LeaseService {
  private leaseRepo = repositories.lease;
  private customerRepo = repositories.customer;
  private unitRepo = repositories.unit;
  private auditRepo = repositories.auditLog;

  async getById(id: string) {
    const lease = await this.leaseRepo.findById(id, { customer: true, unit: true, property: true });
    if (!lease) throw new NotFoundError('Lease not found');
    return lease;
  }

  async list(orgId?: string) {
    const organizationId = orgId ?? (await getActiveOrganizationId());
    return this.leaseRepo.findAll({ organizationId });
  }

  async create(input: CreateLeaseInput) {
    const orgId = await getActiveOrganizationId();
    const customer = await this.customerRepo.findById(input.customerId);
    if (!customer) throw new NotFoundError('Customer not found');

    const unit = await this.unitRepo.findById(input.unitId);
    if (!unit) throw new NotFoundError('Unit not found');

    const leaseNumber = input.leaseNumber ?? `LEASE-${Date.now()}`;

    const lease = await this.leaseRepo.create({
      organizationId: orgId,
      customerId: input.customerId,
      propertyId: input.propertyId,
      unitId: input.unitId,
      leaseNumber,
      startDate: input.startDate,
      endDate: input.endDate,
      moveInDate: input.moveInDate,
      moveOutDate: input.moveOutDate,
      billingStartDate: input.billingStartDate ?? input.startDate,
      billingEndDate: input.billingEndDate,
      status: 'ACTIVE',
      depositAmount: input.depositAmount ?? 0,
      recurringCharge: input.recurringCharge ?? 0,
      serviceAgreement: input.serviceAgreement,
    });

    // Update unit occupancy status
    await this.unitRepo.update(input.unitId, { occupancyStatus: 'OCCUPIED' });

    const user = await getCurrentUser();
    if (user) {
      await this.auditRepo.create({
        organizationId: orgId,
        actorId: user.id,
        action: 'lease.create',
        entityType: 'Lease',
        entityId: lease.id,
        metadata: { leaseNumber, customerId: input.customerId, unitId: input.unitId },
      });
    }

    logger.info({ leaseId: lease.id, leaseNumber }, 'Lease created');
    return lease;
  }

  async terminate(id: string, moveOutDate: Date) {
    const lease = await this.getById(id);
    const updated = await this.leaseRepo.update(id, {
      status: 'TERMINATED',
      moveOutDate,
      billingEndDate: moveOutDate,
    });

    // Update unit occupancy
    await this.unitRepo.update(lease.unitId, { occupancyStatus: 'VACANT' });

    const user = await getCurrentUser();
    if (user) {
      await this.auditRepo.create({
        organizationId: lease.organizationId,
        actorId: user.id,
        action: 'lease.terminate',
        entityType: 'Lease',
        entityId: id,
        metadata: { moveOutDate },
      });
    }

    return updated;
  }

  async renew(id: string, newEndDate: Date, newRecurringCharge?: number) {
    const lease = await this.getById(id);
    const updated = await this.leaseRepo.update(id, {
      status: 'RENEWED',
      endDate: newEndDate,
      recurringCharge: newRecurringCharge ?? lease.recurringCharge,
    });

    return updated;
  }

  calculateProration(startDate: Date, endDate: Date, monthlyAmount: number): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const dailyRate = new Decimal(monthlyAmount).div(daysInMonth);
    return dailyRate.mul(days).toNumber();
  }
}

export const leaseService = new LeaseService();
