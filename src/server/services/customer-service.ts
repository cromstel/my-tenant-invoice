import { getCurrentUser } from '@/lib/auth';
import { NotFoundError } from '@/lib/errors';
import logger from '@/lib/logging/logger';
import { getActiveOrganizationId } from '@/lib/tenant';
import { repositories } from '@/server/repositories';

export interface CreateCustomerInput {
  type?: 'INDIVIDUAL' | 'COMPANY';
  companyName?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  billingAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  taxVatNumber?: string;
  internalNotes?: string;
  propertyId?: string;
}

export interface CreateCustomerContactInput {
  customerId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  isPrimary?: boolean;
}

export class CustomerService {
  private customerRepo = repositories.customer;
  private contactRepo = repositories.customerContact;
  private auditRepo = repositories.auditLog;

  async getById(id: string) {
    const customer = await this.customerRepo.findById(id, { contacts: true });
    if (!customer) throw new NotFoundError('Customer not found');
    return customer;
  }

  async list(orgId?: string) {
    const organizationId = orgId ?? (await getActiveOrganizationId());
    return this.customerRepo.findAll({ organizationId });
  }

  async create(input: CreateCustomerInput) {
    const orgId = await getActiveOrganizationId();
    const customerNumber = `CUST-${Date.now()}`;

    const customer = await this.customerRepo.create({
      organizationId: orgId,
      customerNumber,
      type: input.type ?? 'INDIVIDUAL',
      companyName: input.companyName,
      firstName: input.firstName,
      lastName: input.lastName,
      fullName:
        input.fullName ??
        (input.firstName && input.lastName
          ? `${input.firstName} ${input.lastName}`
          : input.companyName),
      email: input.email,
      phoneNumber: input.phoneNumber,
      billingAddress: input.billingAddress,
      city: input.city,
      state: input.state,
      zipCode: input.zipCode,
      country: input.country,
      taxVatNumber: input.taxVatNumber,
      internalNotes: input.internalNotes,
      propertyId: input.propertyId,
    });

    const user = await getCurrentUser();
    if (user) {
      await this.auditRepo.create({
        organizationId: orgId,
        actorId: user.id,
        action: 'customer.create',
        entityType: 'Customer',
        entityId: customer.id,
        metadata: { name: customer.fullName, email: customer.email },
      });
    }

    logger.info({ customerId: customer.id, name: customer.fullName }, 'Customer created');
    return customer;
  }

  async update(id: string, input: Partial<CreateCustomerInput>) {
    await this.getById(id);
    return this.customerRepo.update(id, input);
  }

  async delete(id: string) {
    await this.getById(id);
    await this.customerRepo.delete(id);
  }

  async addContact(input: CreateCustomerContactInput) {
    await this.getById(input.customerId);
    return this.contactRepo.create({
      customerId: input.customerId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phoneNumber: input.phoneNumber,
      isPrimary: input.isPrimary ?? false,
    });
  }

  async getBalance(customerId: string): Promise<number> {
    await this.getById(customerId);
    // Balance would be calculated from invoices and payments
    // This is a placeholder - actual implementation would aggregate
    return 0;
  }
}

export const customerService = new CustomerService();
