import { Decimal } from 'decimal.js';

import { getCurrentUser } from '@/lib/auth';
import { NotFoundError } from '@/lib/errors';
import logger from '@/lib/logging/logger';
import { getActiveOrganizationId } from '@/lib/tenant';
import { repositories } from '@/server/repositories';

export interface CreateTariffInput {
  serviceId: string;
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface CreateTariffVersionInput {
  tariffId: string;
  versionNumber: number;
  effectiveDate: Date;
  endDate?: Date;
  tariffType: string;
  rules: Record<string, unknown>;
}

export interface TariffCalculationInput {
  tariffType: string;
  rules: Record<string, unknown>;
  quantity: number;
  unitPrice?: number;
}

export class TariffService {
  private tariffRepo = repositories.tariff;
  private versionRepo = repositories.tariffVersion;
  private auditRepo = repositories.auditLog;

  async getById(id: string) {
    const tariff = await this.tariffRepo.findById(id, { versions: true });
    if (!tariff) throw new NotFoundError('Tariff not found');
    return tariff;
  }

  async list(orgId?: string) {
    const organizationId = orgId ?? (await getActiveOrganizationId());
    return this.tariffRepo.findAll({ organizationId });
  }

  async create(input: CreateTariffInput) {
    const orgId = await getActiveOrganizationId();
    const tariff = await this.tariffRepo.create({
      organizationId: orgId,
      serviceId: input.serviceId,
      name: input.name,
      description: input.description,
      isActive: input.isActive ?? true,
    });

    const user = await getCurrentUser();
    if (user) {
      await this.auditRepo.create({
        organizationId: orgId,
        actorId: user.id,
        action: 'tariff.create',
        entityType: 'Tariff',
        entityId: tariff.id,
        metadata: { name: tariff.name, serviceId: input.serviceId },
      });
    }

    logger.info({ tariffId: tariff.id, name: tariff.name }, 'Tariff created');
    return tariff;
  }

  async createVersion(input: CreateTariffVersionInput) {
    await this.getById(input.tariffId);
    const version = await this.versionRepo.create({
      tariffId: input.tariffId,
      versionNumber: input.versionNumber,
      effectiveDate: input.effectiveDate,
      endDate: input.endDate,
      tariffType: input.tariffType,
      rules: input.rules,
    });

    return version;
  }

  async getActiveVersion(tariffId: string, asOfDate?: Date) {
    await this.getById(tariffId);
    const date = asOfDate ?? new Date();
    const tariff = await this.tariffRepo.findById(tariffId, { versions: true });
    if (!tariff) throw new NotFoundError('Tariff not found');
    const versions = tariff.versions ?? [];
    const active = versions.find((v: { effectiveDate: Date; endDate: Date | null }) => {
      const effective = new Date(v.effectiveDate);
      const end = v.endDate ? new Date(v.endDate) : null;
      return effective <= date && (!end || end >= date);
    });
    if (!active) throw new NotFoundError('No active tariff version found');
    return active;
  }

  calculateCharge(input: TariffCalculationInput): number {
    const { tariffType, rules, quantity, unitPrice = 0 } = input;
    const qty = new Decimal(quantity);

    switch (tariffType) {
      case 'FLAT_RATE':
        return new Decimal((rules.rate as number) ?? 0).mul(qty).toNumber();

      case 'TIERED': {
        const tiers = (rules.tiers as Array<{ from: number; to: number; rate: number }>) ?? [];
        let total = new Decimal(0);
        let remaining = qty;
        for (const tier of tiers) {
          const tierQty = new Decimal(Math.min(remaining.toNumber(), tier.to - tier.from + 1));
          if (tierQty.lte(0)) break;
          total = total.plus(tierQty.mul(tier.rate));
          remaining = remaining.minus(tierQty);
        }
        return total.toNumber();
      }

      case 'BLOCK': {
        const blocks = (rules.blocks as Array<{ size: number; rate: number }>) ?? [];
        let total = new Decimal(0);
        let remaining = qty;
        for (const block of blocks) {
          const blockQty = new Decimal(Math.min(remaining.toNumber(), block.size));
          if (blockQty.lte(0)) break;
          total = total.plus(blockQty.mul(block.rate));
          remaining = remaining.minus(blockQty);
        }
        if (remaining.gt(0)) {
          total = total.plus(remaining.mul((rules.defaultRate as number) ?? 0));
        }
        return total.toNumber();
      }

      case 'STANDING_CHARGE':
        return new Decimal((rules.standingCharge as number) ?? 0).toNumber();

      case 'PERCENTAGE':
        return new Decimal(unitPrice)
          .mul(qty)
          .mul(new Decimal((rules.percentage as number) ?? 0).div(100))
          .toNumber();

      case 'MIN_CHARGE': {
        const charge = new Decimal((rules.rate as number) ?? 0).mul(qty);
        const min = new Decimal((rules.minimum as number) ?? 0);
        return charge.gte(min) ? charge.toNumber() : min.toNumber();
      }

      case 'MAX_CHARGE': {
        const charge = new Decimal((rules.rate as number) ?? 0).mul(qty);
        const max = new Decimal((rules.maximum as number) ?? Infinity);
        return charge.lte(max) ? charge.toNumber() : max.toNumber();
      }

      default:
        return new Decimal((rules.rate as number) ?? 0).mul(qty).toNumber();
    }
  }
}

export const tariffService = new TariffService();
