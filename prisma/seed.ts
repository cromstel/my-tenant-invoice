import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import {
  OrganizationStatus,
  PrismaClient,
  SubscriptionInterval,
  SubscriptionStatus,
} from '@prisma/client';

import { ROLE_PERMISSIONS, type RoleName } from '@/config/roles';
import { auth } from '@/lib/better-auth';
import { env } from '@/lib/config/env';
import logger from '@/lib/logging/logger';

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(env.DATABASE_URL) });

/**
 * The platform organization is not a tenant. It exists so platform operators
 * hold a real membership row: `isPlatformAdmin()` resolves roles from
 * memberships, so a platform admin without one is indistinguishable from a
 * regular user.
 */
const PLATFORM_ORG_ID = '00000000-0000-0000-0000-000000000000';

const PLATFORM_ROLES: ReadonlyArray<{ name: RoleName; description: string }> = [
  {
    name: 'PLATFORM_ADMIN',
    description: 'Full platform-level super administrator with unrestricted access',
  },
  {
    name: 'PLATFORM_SUPPORT',
    description: 'Platform support agent with read-only access across tenants for troubleshooting',
  },
  {
    name: 'ORG_OWNER',
    description: 'Organization owner with full administrative access to their tenant',
  },
  {
    name: 'ORG_ADMIN',
    description:
      'Organization administrator with management access excluding billing and user deletion',
  },
  {
    name: 'ORG_ACCOUNTANT',
    description: 'Organization accountant with access to billing, invoices, payments and reports',
  },
  {
    name: 'ORG_STAFF',
    description: 'Organization staff member with limited operational access',
  },
  {
    name: 'TENANT_USER',
    description: 'End-customer tenant user with access to client portal only',
  },
];

/**
 * The concrete permissions the application checks at runtime. The seeded
 * permission rows are derived from this list so the database and
 * `src/config/roles.ts` stay a single vocabulary.
 */
const CONCRETE_PERMISSIONS: readonly string[] = [
  'customer.create',
  'customer.delete',
  'customer.read',
  'customer.update',
  'invoice.approve',
  'invoice.cancel',
  'invoice.create',
  'invoice.delete',
  'invoice.read',
  'invoice.send',
  'invoice.update',
  'invoice.void',
  'lease.create',
  'lease.read',
  'lease.update',
  'meter.create',
  'meter.read',
  'meter.update',
  'org.create',
  'org.delete',
  'org.read',
  'org.update',
  'payment.read',
  'payment.record',
  'payment.refund',
  'platform.read',
  'portal.read',
  'portal.pay',
  'property.create',
  'property.delete',
  'property.read',
  'property.update',
  'report.read',
  'service.create',
  'service.delete',
  'service.read',
  'service.update',
  'tariff.create',
  'tariff.read',
  'team.invite',
  'team.read',
  'team.remove',
];

/**
 * Expands a role's permission list, resolving `resource.*` wildcards against
 * the concrete permission vocabulary.
 */
function expandPermissions(role: RoleName): string[] {
  const permissions = ROLE_PERMISSIONS[role] ?? [];
  if (permissions.includes('*')) return [...CONCRETE_PERMISSIONS];

  const expanded = new Set<string>();
  for (const permission of permissions) {
    if (permission.endsWith('.*')) {
      const prefix = permission.slice(0, -2);
      for (const concrete of CONCRETE_PERMISSIONS) {
        if (concrete.startsWith(`${prefix}.`) || concrete === prefix) expanded.add(concrete);
      }
      continue;
    }
    expanded.add(permission);
  }
  return [...expanded];
}

async function seedRolesAndPermissions(): Promise<void> {
  logger.info('Seeding roles and permissions...');

  for (const role of PLATFORM_ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description, isPlatformRole: role.name.startsWith('PLATFORM_') },
      create: {
        name: role.name,
        description: role.description,
        isPlatformRole: role.name.startsWith('PLATFORM_'),
      },
    });
  }

  for (const permission of CONCRETE_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name: permission },
      update: {},
      create: { name: permission, description: `Grants ${permission}` },
    });
  }
  logger.info(`  Permissions: ${CONCRETE_PERMISSIONS.length} total`);

  for (const role of PLATFORM_ROLES) {
    const dbRole = await prisma.role.findUnique({ where: { name: role.name } });
    if (!dbRole) continue;
    const permissionNames = expandPermissions(role.name);
    for (const permissionName of permissionNames) {
      const permission = await prisma.permission.findUnique({ where: { name: permissionName } });
      if (!permission) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: dbRole.id, permissionId: permission.id } },
        update: {},
        create: { roleId: dbRole.id, permissionId: permission.id },
      });
    }
    logger.info(`  Role ${role.name}: linked ${permissionNames.length} permissions`);
  }
}

/**
 * Subscription plans mirror the tiers in
 * `docs/01-product/business-requirements.md`: a free tier, Pro at $149, and
 * Enterprise on a custom contract.
 */
async function seedSubscriptionPlans(): Promise<void> {
  logger.info('Seeding subscription plans...');

  const plans = [
    {
      name: 'FREE',
      description: 'Free tier for evaluation: up to 20 invoices per month',
      price: 0.0,
      currency: 'USD',
      interval: SubscriptionInterval.MONTHLY,
      features: {
        maxProperties: 3,
        maxUnits: 20,
        maxCustomers: 10,
        maxInvoicesPerMonth: 20,
        billingFrequency: true,
        invoiceCustomBranding: false,
        apiAccess: false,
        supportLevel: 'community',
        reports: ['basic'],
      },
    },
    {
      name: 'PRO',
      description: 'Pro tier: $149 per month plus $1.20 per active unit (50-5,000 units)',
      price: 149.0,
      currency: 'USD',
      interval: SubscriptionInterval.MONTHLY,
      features: {
        maxProperties: 100,
        maxUnits: 5000,
        maxCustomers: 2000,
        minUnits: 50,
        perActiveUnitPrice: 1.2,
        billingFrequency: true,
        invoiceCustomBranding: true,
        apiAccess: true,
        supportLevel: 'priority',
        reports: ['basic', 'financial', 'analytics'],
      },
    },
    {
      name: 'ENTERPRISE',
      description: 'Enterprise contract: custom volume pricing from $2,500 per month',
      price: 2500.0,
      currency: 'USD',
      interval: SubscriptionInterval.MONTHLY,
      features: {
        maxProperties: -1,
        maxUnits: -1,
        maxCustomers: -1,
        customVolumePricing: true,
        onPremiseDeployment: true,
        customSla: true,
        whiteLabel: true,
        dedicatedAccountManager: true,
        billingFrequency: true,
        invoiceCustomBranding: true,
        apiAccess: true,
        supportLevel: 'dedicated',
        reports: ['basic', 'financial', 'analytics', 'custom'],
      },
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { name: plan.name },
      update: {
        description: plan.description,
        price: plan.price,
        currency: plan.currency,
        interval: plan.interval,
        features: plan.features,
      },
      create: plan,
    });
    logger.info(`  Plan: ${plan.name} (${plan.interval})`);
  }
}

/**
 * Creates (or repairs) a user that can actually sign in.
 *
 * Better Auth 1.7 stores the credential hash on the `account` row with
 * `providerId: 'credential'`; seeding only `user.passwordHash` produces a
 * user that exists but can never authenticate.
 */
async function ensureCredentialUser(
  email: string,
  name: string,
  password: string,
): Promise<string> {
  const user = await prisma.user.upsert({
    where: { email },
    update: { name },
    create: { email, name, emailVerified: new Date() },
  });

  const context = await auth.$context;
  const passwordHash = await context.password.hash(password);

  await prisma.account.upsert({
    where: { providerId_accountId: { providerId: 'credential', accountId: user.id } },
    update: { password: passwordHash, userId: user.id, type: 'credential' },
    create: {
      userId: user.id,
      providerId: 'credential',
      accountId: user.id,
      password: passwordHash,
      type: 'credential',
    },
  });

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  return user.id;
}

async function seedPlatformAdmin(): Promise<void> {
  logger.info('Seeding platform admin user...');

  const adminEmail = env.PLATFORM_ADMIN_EMAIL;
  const adminPassword = env.PLATFORM_ADMIN_PASSWORD ?? 'PlatformAdmin123!';

  if (!adminEmail) {
    logger.warn('  PLATFORM_ADMIN_EMAIL not set; skipping platform admin seed');
    return;
  }

  await prisma.organization.upsert({
    where: { id: PLATFORM_ORG_ID },
    update: {},
    create: {
      id: PLATFORM_ORG_ID,
      name: 'CromStel Platform',
      slug: 'platform',
      status: OrganizationStatus.ACTIVE,
      currency: 'USD',
      locale: 'en-US',
      timezone: 'America/New_York',
      invoicePrefix: 'PLT-',
      nextInvoiceNumber: 1,
    },
  });

  const userId = await ensureCredentialUser(adminEmail, 'Platform Administrator', adminPassword);

  const platformAdminRole = await prisma.role.findUnique({ where: { name: 'PLATFORM_ADMIN' } });
  if (platformAdminRole) {
    await prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: PLATFORM_ORG_ID, userId } },
      update: { roleId: platformAdminRole.id },
      create: { organizationId: PLATFORM_ORG_ID, userId, roleId: platformAdminRole.id },
    });
  }

  logger.info(`  Platform admin user: ${adminEmail}`);
}

type SeededUser = { email: string; name: string; password: string; role: RoleName };

const DEMO_USERS: readonly SeededUser[] = [
  { email: 'owner@demopm.com', name: 'Dana Okafor', password: 'DemoOwner123!', role: 'ORG_OWNER' },
  {
    email: 'admin@demopm.com',
    name: 'Luis Marchetti',
    password: 'DemoAdmin123!',
    role: 'ORG_ADMIN',
  },
  {
    email: 'accountant@demopm.com',
    name: 'Sofia Bianchi',
    password: 'DemoAccountant123!',
    role: 'ORG_ACCOUNTANT',
  },
  { email: 'staff@demopm.com', name: 'Jonas Weber', password: 'DemoStaff123!', role: 'ORG_STAFF' },
  {
    email: 'resident@demopm.com',
    name: 'Alex Morgan',
    password: 'DemoResident123!',
    role: 'TENANT_USER',
  },
];

async function seedSampleOrganization(): Promise<void> {
  logger.info('Seeding sample tenant organization...');

  const demoOrg = await prisma.organization.upsert({
    where: { slug: 'demo-org' },
    update: {},
    create: {
      name: 'Demo Property Management Inc.',
      slug: 'demo-org',
      status: OrganizationStatus.ACTIVE,
      billingEmail: 'billing@demopm.com',
      contactEmail: 'hello@demopm.com',
      phoneNumber: '+1-555-0123',
      address: '123 Main Street',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'US',
      taxId: '12-3456789',
      currency: 'USD',
      locale: 'en-US',
      timezone: 'America/New_York',
      invoicePrefix: 'INV-',
      nextInvoiceNumber: 4,
    },
  });

  for (const seeded of DEMO_USERS) {
    const userId = await ensureCredentialUser(seeded.email, seeded.name, seeded.password);
    const role = await prisma.role.findUnique({ where: { name: seeded.role } });
    if (!role) continue;
    await prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: demoOrg.id, userId } },
      update: { roleId: role.id },
      create: { organizationId: demoOrg.id, userId, roleId: role.id },
    });
  }

  const proPlan = await prisma.subscriptionPlan.findUnique({ where: { name: 'PRO' } });
  if (proPlan) {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1);
    await prisma.organizationSubscription.upsert({
      where: { organizationId: demoOrg.id },
      update: { planId: proPlan.id, status: SubscriptionStatus.ACTIVE },
      create: {
        organizationId: demoOrg.id,
        planId: proPlan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: endDate,
      },
    });
  }

  logger.info(`  Demo org: ${demoOrg.slug} with ${DEMO_USERS.length} users`);
}

/**
 * Demo portfolio data so every portal renders real content instead of empty
 * states: one property with four units, two residents, a live lease each,
 * utility meters with readings, and invoices in different states.
 */
async function seedDemoPortfolio(): Promise<void> {
  logger.info('Seeding demo portfolio data...');

  const org = await prisma.organization.findUnique({ where: { slug: 'demo-org' } });
  if (!org) {
    logger.warn('  demo-org missing; skipping portfolio seed');
    return;
  }
  const organizationId = org.id;

  const property = await prisma.property.upsert({
    where: { id: `${organizationId}-property-maple-court` },
    update: {},
    create: {
      id: `${organizationId}-property-maple-court`,
      organizationId,
      name: 'Maple Court Apartments',
      address: '425 Maple Street',
      propertyType: 'RESIDENTIAL',
      owner: 'Demo Property Management Inc.',
      manager: 'Dana Okafor',
      unitCount: 4,
      occupancyRate: 75,
    },
  });

  const unitSpecs = [
    {
      number: '1A',
      type: 'APARTMENT' as const,
      bedrooms: 2,
      bathrooms: 1,
      sqft: 780,
      status: 'OCCUPIED' as const,
    },
    {
      number: '1B',
      type: 'APARTMENT' as const,
      bedrooms: 1,
      bathrooms: 1,
      sqft: 540,
      status: 'OCCUPIED' as const,
    },
    {
      number: '2A',
      type: 'APARTMENT' as const,
      bedrooms: 2,
      bathrooms: 2,
      sqft: 910,
      status: 'OCCUPIED' as const,
    },
    {
      number: '2B',
      type: 'APARTMENT' as const,
      bedrooms: 1,
      bathrooms: 1,
      sqft: 545,
      status: 'VACANT' as const,
    },
  ];

  const units = new Map<string, { id: string; number: string }>();
  for (const spec of unitSpecs) {
    const unit = await prisma.unit.upsert({
      where: { id: `${organizationId}-unit-${spec.number}` },
      update: { occupancyStatus: spec.status },
      create: {
        id: `${organizationId}-unit-${spec.number}`,
        organizationId,
        propertyId: property.id,
        unitNumber: spec.number,
        unitType: spec.type,
        bedrooms: spec.bedrooms,
        bathrooms: spec.bathrooms,
        squareFootage: spec.sqft,
        occupancyStatus: spec.status,
      },
    });
    units.set(spec.number, { id: unit.id, number: unit.unitNumber });
  }

  const residents = [
    {
      number: 'C-1001',
      name: 'Alex Morgan',
      email: 'resident@demopm.com',
      phone: '+1-555-0142',
      unit: '1A',
      rent: 1850,
      deposit: 1850,
      startDate: new Date('2025-09-01'),
    },
    {
      number: 'C-1002',
      name: 'Priya Raman',
      email: 'priya.raman@example.com',
      phone: '+1-555-0177',
      unit: '1B',
      rent: 1620,
      deposit: 1620,
      startDate: new Date('2026-01-01'),
    },
    {
      number: 'C-1003',
      name: 'Noah Fischer',
      email: 'noah.fischer@example.com',
      phone: '+1-555-0163',
      unit: '2A',
      rent: 2250,
      deposit: 2250,
      startDate: new Date('2025-11-01'),
    },
  ];

  const customers = new Map<string, { id: string; name: string }>();
  const leases = new Map<string, { id: string; customerId: string; unitId: string }>();

  for (const resident of residents) {
    const unit = units.get(resident.unit);
    if (!unit) continue;

    const customer = await prisma.customer.upsert({
      where: { id: `${organizationId}-customer-${resident.number}` },
      update: {},
      create: {
        id: `${organizationId}-customer-${resident.number}`,
        organizationId,
        propertyId: property.id,
        customerNumber: resident.number,
        type: 'INDIVIDUAL',
        firstName: resident.name.split(' ')[0],
        lastName: resident.name.split(' ').slice(1).join(' '),
        fullName: resident.name,
        email: resident.email,
        phoneNumber: resident.phone,
        billingAddress: `425 Maple Street, Apt ${resident.unit}`,
        city: 'Brooklyn',
        state: 'NY',
        zipCode: '11201',
        country: 'US',
      },
    });
    customers.set(resident.number, { id: customer.id, name: resident.name });

    const lease = await prisma.lease.upsert({
      where: { id: `${organizationId}-lease-${resident.number}` },
      update: {},
      create: {
        id: `${organizationId}-lease-${resident.number}`,
        organizationId,
        customerId: customer.id,
        propertyId: property.id,
        unitId: unit.id,
        leaseNumber: `L-${resident.number}`,
        startDate: resident.startDate,
        moveInDate: resident.startDate,
        billingStartDate: resident.startDate,
        endDate: new Date('2026-08-31'),
        status: 'ACTIVE',
        depositAmount: resident.deposit,
        recurringCharge: resident.rent,
      },
    });
    leases.set(resident.number, { id: lease.id, customerId: customer.id, unitId: unit.id });

    await prisma.unit.update({
      where: { id: unit.id },
      data: { currentLeaseId: lease.id },
    });
  }

  const rentService = await prisma.service.upsert({
    where: { id: `${organizationId}-service-rent` },
    update: {},
    create: {
      id: `${organizationId}-service-rent`,
      organizationId,
      name: 'Rent',
      description: 'Monthly residential rent',
      serviceType: 'RENT',
      isBillable: true,
      defaultPrice: 1850,
    },
  });

  const electricityService = await prisma.service.upsert({
    where: { id: `${organizationId}-service-electricity` },
    update: {},
    create: {
      id: `${organizationId}-service-electricity`,
      organizationId,
      name: 'Electricity',
      description: 'Residential electricity consumption',
      serviceType: 'ELECTRICITY',
      isBillable: true,
      defaultPrice: 0.18,
    },
  });

  const electricityTariff = await prisma.tariff.upsert({
    where: { id: `${organizationId}-tariff-electricity` },
    update: {},
    create: {
      id: `${organizationId}-tariff-electricity`,
      organizationId,
      serviceId: electricityService.id,
      name: 'Residential Electricity',
      description: 'Tiered residential electricity rate',
      isActive: true,
    },
  });

  await prisma.tariffVersion.upsert({
    where: { id: `${organizationId}-tariffversion-electricity-v1` },
    update: {},
    create: {
      id: `${organizationId}-tariffversion-electricity-v1`,
      tariffId: electricityTariff.id,
      versionNumber: 1,
      effectiveDate: new Date('2026-01-01'),
      tariffType: 'TIERED',
      rules: {
        tiers: [
          { upTo: 500, rate: 0.18 },
          { upTo: 1500, rate: 0.24 },
        ],
      },
    },
  });

  const meterSpecs = [
    {
      serial: 'ELEC-1A',
      type: 'ELECTRICITY' as const,
      unit: 'kWh',
      unitNumber: '1A',
      opening: 1200,
      latest: 1385.4,
    },
    {
      serial: 'ELEC-1B',
      type: 'ELECTRICITY' as const,
      unit: 'kWh',
      unitNumber: '1B',
      opening: 640,
      latest: 812.9,
    },
    {
      serial: 'WTR-1A',
      type: 'WATER' as const,
      unit: 'm3',
      unitNumber: '1A',
      opening: 210,
      latest: 268.5,
    },
  ];

  for (const spec of meterSpecs) {
    const unit = units.get(spec.unitNumber);
    const meter = await prisma.meter.upsert({
      where: { id: `${organizationId}-meter-${spec.serial}` },
      update: {},
      create: {
        id: `${organizationId}-meter-${spec.serial}`,
        organizationId,
        propertyId: property.id,
        unitId: unit?.id ?? null,
        tariffId: spec.type === 'ELECTRICITY' ? electricityTariff.id : null,
        serialNumber: spec.serial,
        meterType: spec.type,
        unitOfMeasurement: spec.unit,
        installationDate: new Date('2025-06-15'),
        openingReading: spec.opening,
        latestReading: spec.latest,
        status: 'ACTIVE',
      },
    });

    await prisma.meterReading.upsert({
      where: { id: `${organizationId}-reading-${spec.serial}-2026-10` },
      update: {},
      create: {
        id: `${organizationId}-reading-${spec.serial}-2026-10`,
        meterId: meter.id,
        reading: spec.latest,
        readingDate: new Date('2026-10-31'),
        readingType: 'MANUAL',
      },
    });
  }

  const alex = customers.get('C-1001');
  const priya = customers.get('C-1002');
  const noah = customers.get('C-1003');
  const alexLease = leases.get('C-1001');
  const priyaLease = leases.get('C-1002');

  const invoiceSpecs = [
    {
      id: `${organizationId}-invoice-0001`,
      number: 'INV-2026-0001',
      customer: alex,
      lease: alexLease,
      status: 'PAID' as const,
      invoiceDate: new Date('2026-10-01'),
      dueDate: new Date('2026-10-15'),
      subtotal: 1874.42,
      tax: 0,
      total: 1874.42,
      paid: 1874.42,
      remaining: 0,
      items: [
        {
          serviceId: rentService.id,
          description: 'Monthly rent - October 2026',
          qty: 1,
          price: 1850,
        },
        {
          serviceId: electricityService.id,
          description: 'Electricity - October 2026',
          qty: 136.2,
          price: 0.18,
        },
      ],
    },
    {
      id: `${organizationId}-invoice-0002`,
      number: 'INV-2026-0002',
      customer: priya,
      lease: priyaLease,
      status: 'OVERDUE' as const,
      invoiceDate: new Date('2026-10-01'),
      dueDate: new Date('2026-10-15'),
      subtotal: 1651.12,
      tax: 0,
      total: 1651.12,
      paid: 400,
      remaining: 1251.12,
      items: [
        {
          serviceId: rentService.id,
          description: 'Monthly rent - October 2026',
          qty: 1,
          price: 1620,
        },
        {
          serviceId: electricityService.id,
          description: 'Electricity - October 2026',
          qty: 173.9,
          price: 0.18,
        },
      ],
    },
    {
      id: `${organizationId}-invoice-0003`,
      number: 'INV-2026-0003',
      customer: noah,
      lease: leases.get('C-1003'),
      status: 'DRAFT' as const,
      invoiceDate: new Date('2026-11-01'),
      dueDate: new Date('2026-11-15'),
      subtotal: 2250,
      tax: 0,
      total: 2250,
      paid: 0,
      remaining: 2250,
      items: [
        {
          serviceId: rentService.id,
          description: 'Monthly rent - November 2026',
          qty: 1,
          price: 2250,
        },
      ],
    },
  ];

  for (const invoice of invoiceSpecs) {
    if (!invoice.customer) continue;
    await prisma.invoice.upsert({
      where: { id: invoice.id },
      update: {},
      create: {
        id: invoice.id,
        organizationId,
        customerId: invoice.customer.id,
        leaseId: invoice.lease?.id ?? null,
        invoiceNumber: invoice.number,
        status: invoice.status,
        invoiceDate: invoice.invoiceDate,
        dueDate: invoice.dueDate,
        currency: 'USD',
        subtotal: invoice.subtotal,
        taxAmount: invoice.tax,
        total: invoice.total,
        amountPaid: invoice.paid,
        remainingBalance: invoice.remaining,
      },
    });

    for (const [index, item] of invoice.items.entries()) {
      await prisma.invoiceItem.upsert({
        where: { id: `${invoice.id}-item-${index + 1}` },
        update: {},
        create: {
          id: `${invoice.id}-item-${index + 1}`,
          invoiceId: invoice.id,
          serviceId: item.serviceId,
          description: item.description,
          quantity: item.qty,
          unitPrice: item.price,
          amount: Number((item.qty * item.price).toFixed(2)),
          taxRate: 0,
          taxAmount: 0,
          billingPeriodStart: invoice.invoiceDate,
          billingPeriodEnd: invoice.invoiceDate,
        },
      });
    }
  }

  if (alex) {
    const payment = await prisma.payment.upsert({
      where: { id: `${organizationId}-payment-0001` },
      update: {},
      create: {
        id: `${organizationId}-payment-0001`,
        organizationId,
        customerId: alex.id,
        transactionId: 'TXN-DEMO-0001',
        paymentMethod: 'BANK_TRANSFER',
        amount: 1874.42,
        currency: 'USD',
        paymentDate: new Date('2026-10-08'),
        status: 'SUCCEEDED',
        type: 'INVOICE_PAYMENT',
        notes: 'Demo payment',
      },
    });

    await prisma.paymentAllocation.upsert({
      where: { id: `${organizationId}-allocation-0001` },
      update: {},
      create: {
        id: `${organizationId}-allocation-0001`,
        paymentId: payment.id,
        invoiceId: `${organizationId}-invoice-0001`,
        amount: 1874.42,
      },
    });
  }

  logger.info('  Portfolio: 1 property, 4 units, 3 residents, 3 invoices, 1 payment');
}

async function main(): Promise<void> {
  logger.info('==================================================');
  logger.info('myTenant Invoice - Database Seeding');
  logger.info('==================================================');

  await seedRolesAndPermissions();
  await seedSubscriptionPlans();
  await seedPlatformAdmin();
  await seedSampleOrganization();
  await seedDemoPortfolio();

  logger.info('==================================================');
  logger.info('Seeding completed successfully');
  logger.info('==================================================');
}

main()
  .catch((err: unknown) => {
    logger.error({ err: err instanceof Error ? err : new Error(String(err)) }, 'Seeding failed');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
