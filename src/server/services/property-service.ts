import { getCurrentUser } from '@/lib/auth';
import { NotFoundError } from '@/lib/errors';
import logger from '@/lib/logging/logger';
import { getActiveOrganizationId } from '@/lib/tenant';
import { repositories } from '@/server/repositories';

export interface CreatePropertyInput {
  name: string;
  address: string;
  propertyType?: string;
  portfolioId?: string;
  owner?: string;
  manager?: string;
  unitCount?: number;
}

export interface CreateBuildingInput {
  propertyId: string;
  name: string;
  address?: string;
  floors?: number;
  yearBuilt?: number;
}

export interface CreateUnitInput {
  propertyId: string;
  buildingId?: string;
  unitNumber: string;
  unitType?: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
}

export class PropertyService {
  private propertyRepo = repositories.property;
  private buildingRepo = repositories.building;
  private unitRepo = repositories.unit;
  private auditRepo = repositories.auditLog;

  async getPropertyById(id: string) {
    const property = await this.propertyRepo.findById(id, {
      portfolio: true,
      buildings: true,
      units: true,
    });
    if (!property) throw new NotFoundError('Property not found');
    return property;
  }

  async listProperties(orgId?: string) {
    const organizationId = orgId ?? (await getActiveOrganizationId());
    return this.propertyRepo.findAll({ organizationId }, { portfolio: true });
  }

  async createProperty(input: CreatePropertyInput) {
    const orgId = await getActiveOrganizationId();
    const property = await this.propertyRepo.create({
      organizationId: orgId,
      name: input.name,
      address: input.address,
      propertyType: input.propertyType ?? 'RESIDENTIAL',
      portfolioId: input.portfolioId,
      owner: input.owner,
      manager: input.manager,
      unitCount: input.unitCount ?? 0,
      occupancyRate: 0,
    });

    const user = await getCurrentUser();
    if (user) {
      await this.auditRepo.create({
        organizationId: orgId,
        actorId: user.id,
        action: 'property.create',
        entityType: 'Property',
        entityId: property.id,
        metadata: { name: property.name, address: property.address },
      });
    }

    logger.info({ propertyId: property.id, name: property.name }, 'Property created');
    return property;
  }

  async updateProperty(id: string, input: Partial<CreatePropertyInput>) {
    await this.getPropertyById(id);
    return this.propertyRepo.update(id, input);
  }

  async deleteProperty(id: string) {
    await this.getPropertyById(id);
    await this.propertyRepo.delete(id);
  }

  async createBuilding(input: CreateBuildingInput) {
    const orgId = await getActiveOrganizationId();
    const building = await this.buildingRepo.create({
      organizationId: orgId,
      propertyId: input.propertyId,
      name: input.name,
      address: input.address,
      floors: input.floors,
      yearBuilt: input.yearBuilt,
    });
    return building;
  }

  async createUnit(input: CreateUnitInput) {
    const orgId = await getActiveOrganizationId();
    const unit = await this.unitRepo.create({
      organizationId: orgId,
      propertyId: input.propertyId,
      buildingId: input.buildingId,
      unitNumber: input.unitNumber,
      unitType: input.unitType ?? 'APARTMENT',
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms,
      squareFootage: input.squareFootage,
      occupancyStatus: 'VACANT',
    });
    return unit;
  }

  async getUnitsByProperty(propertyId: string) {
    return this.unitRepo.findAll({ propertyId });
  }

  async updateUnitOccupancy(unitId: string, status: string) {
    return this.unitRepo.update(unitId, { occupancyStatus: status });
  }
}

export const propertyService = new PropertyService();
