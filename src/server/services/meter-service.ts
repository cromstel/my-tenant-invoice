import { Decimal } from 'decimal.js';

import { getCurrentUser } from '@/lib/auth';
import { NotFoundError } from '@/lib/errors';
import logger from '@/lib/logging/logger';
import { getActiveOrganizationId } from '@/lib/tenant';
import { repositories } from '@/server/repositories';

export interface CreateMeterInput {
  propertyId: string;
  unitId?: string;
  tariffId?: string;
  serialNumber: string;
  meterType?: string;
  unitOfMeasurement: string;
  installationDate: Date;
  removalDate?: Date;
  multiplier?: number;
  openingReading?: number;
}

export interface CreateMeterReadingInput {
  meterId: string;
  reading: number;
  readingDate: Date;
  readingType?: string;
  isEstimated?: boolean;
  notes?: string;
}

export class MeterService {
  private meterRepo = repositories.meter;
  private readingRepo = repositories.meterReading;
  private auditRepo = repositories.auditLog;

  async getById(id: string) {
    const meter = await this.meterRepo.findById(id, {
      readings: true,
      property: true,
      unit: true,
      tariff: true,
    });
    if (!meter) throw new NotFoundError('Meter not found');
    return meter;
  }

  async list(orgId?: string) {
    const organizationId = orgId ?? (await getActiveOrganizationId());
    return this.meterRepo.findAll({ organizationId });
  }

  async create(input: CreateMeterInput) {
    const orgId = await getActiveOrganizationId();
    const meter = await this.meterRepo.create({
      organizationId: orgId,
      propertyId: input.propertyId,
      unitId: input.unitId,
      tariffId: input.tariffId,
      serialNumber: input.serialNumber,
      meterType: input.meterType ?? 'ELECTRICITY',
      unitOfMeasurement: input.unitOfMeasurement,
      installationDate: input.installationDate,
      removalDate: input.removalDate,
      multiplier: input.multiplier ?? 1,
      openingReading: input.openingReading ?? 0,
      latestReading: input.openingReading ?? 0,
      status: 'ACTIVE',
    });

    const user = await getCurrentUser();
    if (user) {
      await this.auditRepo.create({
        organizationId: orgId,
        actorId: user.id,
        action: 'meter.create',
        entityType: 'Meter',
        entityId: meter.id,
        metadata: { serialNumber: meter.serialNumber, type: meter.meterType },
      });
    }

    logger.info({ meterId: meter.id, serialNumber: meter.serialNumber }, 'Meter created');
    return meter;
  }

  async addReading(input: CreateMeterReadingInput) {
    const meter = await this.getById(input.meterId);
    const reading = await this.readingRepo.create({
      meterId: input.meterId,
      reading: input.reading,
      readingDate: input.readingDate,
      readingType: input.readingType ?? 'MANUAL',
      isEstimated: input.isEstimated ?? false,
      anomalyDetected: false,
      notes: input.notes,
    });

    // Update meter's latest reading
    await this.meterRepo.update(input.meterId, { latestReading: input.reading });

    // Detect anomalies
    const anomaly = this.detectAnomaly(meter, input.reading);
    if (anomaly) {
      await this.readingRepo.update(reading.id, { anomalyDetected: true });
    }

    const user = await getCurrentUser();
    if (user) {
      await this.auditRepo.create({
        organizationId: meter.organizationId,
        actorId: user.id,
        action: 'meter.reading.create',
        entityType: 'MeterReading',
        entityId: reading.id,
        metadata: { meterId: input.meterId, reading: input.reading, anomaly },
      });
    }

    logger.info({ readingId: reading.id, meterId: input.meterId, anomaly }, 'Meter reading added');
    return { reading, anomaly };
  }

  detectAnomaly(
    meter: { openingReading: unknown; latestReading: unknown },
    newReading: number,
  ): boolean {
    const latest = new Decimal(Number(meter.latestReading));
    const newR = new Decimal(newReading);
    // Negative reading
    if (newR.lt(0)) return true;
    // Reading decreased (possible meter reset or error)
    if (newR.lt(latest)) return true;
    // Spike detection: more than 10x previous consumption
    const consumption = newR.minus(latest);
    const prevConsumption = latest.minus(new Decimal(Number(meter.openingReading)));
    if (prevConsumption.gt(0) && consumption.gt(prevConsumption.mul(10))) return true;
    return false;
  }

  async getConsumption(meterId: string, startDate: Date, endDate: Date) {
    const meter = await this.getById(meterId);
    const readings = await this.readingRepo.findAll({ meterId }, undefined, { readingDate: 'asc' });

    const filtered = readings.filter((r: { readingDate: Date }) => {
      const d = new Date(r.readingDate);
      return d >= startDate && d <= endDate;
    });

    if (filtered.length < 2) return { consumption: 0, readings: filtered };

    const firstReading = filtered[0];
    const lastReading = filtered[filtered.length - 1];
    if (!firstReading || !lastReading) return { consumption: 0, readings: filtered };

    const first = new Decimal(Number(firstReading.reading));
    const last = new Decimal(Number(lastReading.reading));
    const consumption = last.minus(first).mul(new Decimal(Number(meter.multiplier) || 1));

    return { consumption: consumption.toNumber(), readings: filtered };
  }

  async updateStatus(id: string, status: string) {
    await this.getById(id);
    return this.meterRepo.update(id, { status });
  }
}

export const meterService = new MeterService();
