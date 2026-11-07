import { getCurrentUser } from '@/lib/auth';
import { NotFoundError } from '@/lib/errors';
import logger from '@/lib/logging/logger';
import { getActiveOrganizationId } from '@/lib/tenant';
import { repositories } from '@/server/repositories';

export interface CreateServiceInput {
  name: string;
  description?: string;
  serviceType?: string;
  isBillable?: boolean;
  defaultPrice?: number;
}

export interface CreateServicePackageInput {
  name: string;
  description?: string;
  items: Array<{ serviceId: string; quantity: number; unitPrice: number }>;
}

export class ServiceService {
  private serviceRepo = repositories.service;
  private packageRepo = repositories.servicePackage;
  private packageItemRepo = repositories.servicePackageItem;
  private auditRepo = repositories.auditLog;

  async getById(id: string) {
    const service = await this.serviceRepo.findById(id, { tariffs: true });
    if (!service) throw new NotFoundError('Service not found');
    return service;
  }

  async list(orgId?: string) {
    const organizationId = orgId ?? (await getActiveOrganizationId());
    return this.serviceRepo.findAll({ organizationId });
  }

  async create(input: CreateServiceInput) {
    const orgId = await getActiveOrganizationId();
    const service = await this.serviceRepo.create({
      organizationId: orgId,
      name: input.name,
      description: input.description,
      serviceType: input.serviceType ?? 'CUSTOM_SERVICE',
      isBillable: input.isBillable ?? true,
      defaultPrice: input.defaultPrice ?? 0,
    });

    const user = await getCurrentUser();
    if (user) {
      await this.auditRepo.create({
        organizationId: orgId,
        actorId: user.id,
        action: 'service.create',
        entityType: 'Service',
        entityId: service.id,
        metadata: { name: service.name, type: service.serviceType },
      });
    }

    logger.info({ serviceId: service.id, name: service.name }, 'Service created');
    return service;
  }

  async update(id: string, input: Partial<CreateServiceInput>) {
    await this.getById(id);
    return this.serviceRepo.update(id, input);
  }

  async delete(id: string) {
    await this.getById(id);
    await this.serviceRepo.delete(id);
  }

  async createPackage(input: CreateServicePackageInput) {
    const orgId = await getActiveOrganizationId();
    const pkg = await this.packageRepo.create({
      organizationId: orgId,
      name: input.name,
      description: input.description,
    });

    for (const item of input.items) {
      await this.packageItemRepo.create({
        servicePackageId: pkg.id,
        serviceId: item.serviceId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      });
    }

    return this.packageRepo.findById(pkg.id, { items: { include: { service: true } } });
  }
}

export const serviceService = new ServiceService();
