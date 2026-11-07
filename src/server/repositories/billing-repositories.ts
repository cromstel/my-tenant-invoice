import type { Prisma } from '@prisma/client';

import prisma from '@/lib/db/prisma';

import { BaseRepository } from './base-repository';

// --- Services & Tariffs ---
export class ServiceRepository extends BaseRepository<
  Prisma.ServiceDelegate,
  Prisma.ServiceGetPayload<{ include: { tariffs: true } }>
> {
  protected get delegate() {
    return prisma.service;
  }
}

export class ServicePackageRepository extends BaseRepository<
  Prisma.ServicePackageDelegate,
  Prisma.ServicePackageGetPayload<{ include: { items: true } }>
> {
  protected get delegate() {
    return prisma.servicePackage;
  }
}

export class ServicePackageItemRepository extends BaseRepository<
  Prisma.ServicePackageItemDelegate,
  Prisma.ServicePackageItemGetPayload<object>
> {
  protected get delegate() {
    return prisma.servicePackageItem;
  }
}

export class TariffRepository extends BaseRepository<
  Prisma.TariffDelegate,
  Prisma.TariffGetPayload<{ include: { versions: true } }>
> {
  protected get delegate() {
    return prisma.tariff;
  }
}

export class TariffVersionRepository extends BaseRepository<
  Prisma.TariffVersionDelegate,
  Prisma.TariffVersionGetPayload<object>
> {
  protected get delegate() {
    return prisma.tariffVersion;
  }
}

// --- Meters ---
export class MeterRepository extends BaseRepository<
  Prisma.MeterDelegate,
  Prisma.MeterGetPayload<{ include: { readings: true } }>
> {
  protected get delegate() {
    return prisma.meter;
  }
}

export class MeterReadingRepository extends BaseRepository<
  Prisma.MeterReadingDelegate,
  Prisma.MeterReadingGetPayload<object>
> {
  protected get delegate() {
    return prisma.meterReading;
  }
}

// --- Billing Cycle ---
export class BillingCycleRepository extends BaseRepository<
  Prisma.BillingCycleDelegate,
  Prisma.BillingCycleGetPayload<object>
> {
  protected get delegate() {
    return prisma.billingCycle;
  }
}
