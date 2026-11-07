import type { Organization } from '@prisma/client';

import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/auth';
import { AuthorizationError, ConflictError, NotFoundError } from '@/lib/errors';
import logger from '@/lib/logging/logger';
import { slugify } from '@/lib/tenant';
import { repositories } from '@/server/repositories';

export interface CreateOrganizationInput {
  name: string;
  slug?: string;
  billingEmail?: string;
  contactEmail?: string;
  phoneNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  taxId?: string;
  currency?: string;
  locale?: string;
  timezone?: string;
}

export interface UpdateOrganizationInput {
  name?: string;
  billingEmail?: string;
  contactEmail?: string;
  phoneNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  taxId?: string;
  currency?: string;
  locale?: string;
  timezone?: string;
  logoUrl?: string;
}

export class OrganizationService {
  private orgRepo = repositories.organization;
  private auditRepo = repositories.auditLog;

  async getById(id: string): Promise<Organization> {
    const org = await this.orgRepo.findById(id);
    if (!org) throw new NotFoundError('Organization not found');
    return org;
  }

  async getBySlug(slug: string): Promise<Organization> {
    const org = await this.orgRepo.findBySlug(slug);
    if (!org) throw new NotFoundError('Organization not found');
    return org;
  }

  async list() {
    return this.orgRepo.findMany({ page: 1, pageSize: 50, sortDir: 'desc' });
  }

  async create(input: CreateOrganizationInput): Promise<Organization> {
    const slug = input.slug ?? slugify(input.name);
    const existing = await this.orgRepo.findBySlug(slug);
    if (existing) throw new ConflictError('Organization slug already exists');

    const org = await this.orgRepo.create({
      name: input.name,
      slug,
      status: 'TRIAL',
      billingEmail: input.billingEmail,
      contactEmail: input.contactEmail,
      phoneNumber: input.phoneNumber,
      address: input.address,
      city: input.city,
      state: input.state,
      zipCode: input.zipCode,
      country: input.country,
      taxId: input.taxId,
      currency: input.currency ?? 'USD',
      locale: input.locale ?? 'en-US',
      timezone: input.timezone ?? 'UTC',
      invoicePrefix: 'INV-',
      nextInvoiceNumber: 1,
    });

    const user = await getCurrentUser();
    if (user) {
      await this.auditRepo.create({
        organizationId: org.id,
        actorId: user.id,
        action: 'organization.create',
        entityType: 'Organization',
        entityId: org.id,
        metadata: { name: org.name, slug: org.slug },
      });
    }

    logger.info({ orgId: org.id, name: org.name }, 'Organization created');
    return org;
  }

  async update(id: string, input: UpdateOrganizationInput): Promise<Organization> {
    await this.getById(id);
    const updated = await this.orgRepo.update(id, {
      ...input,
    });

    const user = await getCurrentUser();
    if (user) {
      await this.auditRepo.create({
        organizationId: id,
        actorId: user.id,
        action: 'organization.update',
        entityType: 'Organization',
        entityId: id,
        metadata: input,
      });
    }

    return updated;
  }

  async updateBranding(id: string, logoUrl: string): Promise<Organization> {
    await this.getById(id);
    return this.orgRepo.update(id, { logoUrl });
  }

  async delete(id: string): Promise<void> {
    const ok = await hasPermission('org.delete');
    if (!ok) throw new AuthorizationError('Requires org.delete permission');
    await this.orgRepo.delete(id);
  }
}

export const organizationService = new OrganizationService();
