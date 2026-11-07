import type { Prisma } from '@prisma/client';

import prisma from '@/lib/db/prisma';

import { BaseRepository } from './base-repository';

// --- Organization ---
export class OrganizationRepository extends BaseRepository<
  Prisma.OrganizationDelegate,
  Prisma.OrganizationGetPayload<{ include: { members: true } }>
> {
  protected get delegate() {
    return prisma.organization;
  }

  async findBySlug(slug: string) {
    return this.findFirst({ slug });
  }
}

export class OrganizationMemberRepository extends BaseRepository<
  Prisma.OrganizationMemberDelegate,
  Prisma.OrganizationMemberGetPayload<{ include: { role: true; user: true } }>
> {
  protected get delegate() {
    return prisma.organizationMember;
  }

  async findByOrgAndUser(organizationId: string, userId: string) {
    return this.findFirst({ organizationId, userId });
  }
}

// --- Property ---
export class PortfolioRepository extends BaseRepository<
  Prisma.PortfolioDelegate,
  Prisma.PortfolioGetPayload<object>
> {
  protected get delegate() {
    return prisma.portfolio;
  }
}

export class PropertyRepository extends BaseRepository<
  Prisma.PropertyDelegate,
  Prisma.PropertyGetPayload<{ include: { portfolio: true; buildings: true } }>
> {
  protected get delegate() {
    return prisma.property;
  }
}

export class BuildingRepository extends BaseRepository<
  Prisma.BuildingDelegate,
  Prisma.BuildingGetPayload<{ include: { property: true; units: true } }>
> {
  protected get delegate() {
    return prisma.building;
  }
}

export class UnitRepository extends BaseRepository<
  Prisma.UnitDelegate,
  Prisma.UnitGetPayload<{ include: { building: true; lease: true } }>
> {
  protected get delegate() {
    return prisma.unit;
  }
}

// --- Customer ---
export class CustomerRepository extends BaseRepository<
  Prisma.CustomerDelegate,
  Prisma.CustomerGetPayload<{ include: { contacts: true } }>
> {
  protected get delegate() {
    return prisma.customer;
  }
}

export class CustomerContactRepository extends BaseRepository<
  Prisma.CustomerContactDelegate,
  Prisma.CustomerContactGetPayload<object>
> {
  protected get delegate() {
    return prisma.customerContact;
  }
}

// --- Lease ---
export class LeaseRepository extends BaseRepository<
  Prisma.LeaseDelegate,
  Prisma.LeaseGetPayload<{ include: { customer: true; unit: true } }>
> {
  protected get delegate() {
    return prisma.lease;
  }
}
