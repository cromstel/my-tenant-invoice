import {
  OrganizationStatus,
  PrismaClient,
  SubscriptionInterval,
  SubscriptionStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

import { env } from '@/lib/config/env';
import logger from '@/lib/logging/logger';

const prisma = new PrismaClient();

const PLATFORM_ROLES = [
  {
    name: 'PLATFORM_ADMIN',
    description: 'Full platform-level super administrator with unrestricted access',
    isPlatformRole: true,
  },
  {
    name: 'PLATFORM_SUPPORT',
    description: 'Platform support agent with read-only access across tenants for troubleshooting',
    isPlatformRole: true,
  },
  {
    name: 'ORG_OWNER',
    description: 'Organization owner with full administrative access to their tenant',
    isPlatformRole: false,
  },
  {
    name: 'ORG_ADMIN',
    description:
      'Organization administrator with management access excluding billing and user deletion',
    isPlatformRole: false,
  },
  {
    name: 'ORG_ACCOUNTANT',
    description: 'Organization accountant with access to billing, invoices, payments and reports',
    isPlatformRole: false,
  },
  {
    name: 'ORG_STAFF',
    description: 'Organization staff member with limited operational access',
    isPlatformRole: false,
  },
  {
    name: 'TENANT_USER',
    description: 'End-customer tenant user with access to client portal only',
    isPlatformRole: false,
  },
];

const PLATFORM_PERMISSIONS = [
  { name: 'platform.admin:manage', description: 'Manage all platform settings and users' },
  { name: 'platform.tenants:create', description: 'Create new tenant organizations' },
  { name: 'platform.tenants:read', description: 'View all tenant organizations' },
  { name: 'platform.tenants:update', description: 'Update tenant organization details' },
  { name: 'platform.tenants:suspend', description: 'Suspend or activate tenant organizations' },
  { name: 'platform.tenants:delete', description: 'Delete tenant organizations' },
  { name: 'platform.tenants:impersonate', description: 'Impersonate tenant users for support' },
  { name: 'platform.plans:manage', description: 'Manage subscription plans and pricing' },
  { name: 'platform.audit:read', description: 'View platform-wide audit logs' },
  { name: 'org.profile:manage', description: 'Manage organization profile and branding' },
  { name: 'org.users:invite', description: 'Invite new users to the organization' },
  { name: 'org.users:manage', description: 'Manage existing organization users' },
  { name: 'org.roles:manage', description: 'Create and manage custom roles and permissions' },
  { name: 'org.billing:manage', description: 'Manage subscription and payment methods' },
  { name: 'property:create', description: 'Create new properties' },
  { name: 'property:read', description: 'View properties' },
  { name: 'property:update', description: 'Update properties' },
  { name: 'property:delete', description: 'Delete properties' },
  { name: 'customer:create', description: 'Create new customers' },
  { name: 'customer:read', description: 'View customers' },
  { name: 'customer:update', description: 'Update customers' },
  { name: 'customer:delete', description: 'Delete customers' },
  { name: 'lease:create', description: 'Create new leases' },
  { name: 'lease:read', description: 'View leases' },
  { name: 'lease:update', description: 'Update leases' },
  { name: 'lease:delete', description: 'Delete leases' },
  { name: 'service:create', description: 'Create billable services and tariffs' },
  { name: 'service:read', description: 'View services and tariffs' },
  { name: 'service:update', description: 'Update services and tariffs' },
  { name: 'meter:read', description: 'View utility meters and readings' },
  { name: 'meter:create', description: 'Register utility meters' },
  { name: 'meter:update', description: 'Update meter details' },
  { name: 'meterreading:create', description: 'Enter meter readings' },
  { name: 'invoice:create', description: 'Create and generate invoices' },
  { name: 'invoice:read', description: 'View invoices' },
  { name: 'invoice:approve', description: 'Approve draft invoices' },
  { name: 'invoice:send', description: 'Send invoices to customers' },
  { name: 'invoice:void', description: 'Void or cancel invoices' },
  { name: 'payment:record', description: 'Record manual payments' },
  { name: 'payment:read', description: 'View payments and allocations' },
  { name: 'payment:refund', description: 'Process payment refunds' },
  { name: 'report:read', description: 'View financial reports and dashboards' },
  { name: 'report:export', description: 'Export reports and data' },
  { name: 'document:upload', description: 'Upload documents and files' },
  { name: 'document:read', description: 'View documents and files' },
  { name: 'document:delete', description: 'Delete documents and files' },
  { name: 'clientportal:access', description: 'Access the end-customer client portal' },
];

const ROLE_PERMISSION_MAP: Record<string, string[]> = {
  PLATFORM_ADMIN: PLATFORM_PERMISSIONS.map((p) => p.name),
  PLATFORM_SUPPORT: [
    'platform.tenants:read',
    'platform.tenants:impersonate',
    'platform.audit:read',
  ],
  ORG_OWNER: PLATFORM_PERMISSIONS.filter(
    (p) => !p.name.startsWith('platform.') || p.name === 'platform.audit:read',
  )
    .filter((p) => !p.name.startsWith('platform.'))
    .map((p) => p.name)
    .concat([
      'org.profile:manage',
      'org.users:invite',
      'org.users:manage',
      'org.roles:manage',
      'org.billing:manage',
    ]),
  ORG_ADMIN: [
    'org.profile:manage',
    'org.users:invite',
    'org.users:manage',
    'property:create',
    'property:read',
    'property:update',
    'customer:create',
    'customer:read',
    'customer:update',
    'customer:delete',
    'lease:create',
    'lease:read',
    'lease:update',
    'service:create',
    'service:read',
    'service:update',
    'meter:read',
    'meter:create',
    'meter:update',
    'meterreading:create',
    'invoice:create',
    'invoice:read',
    'invoice:approve',
    'invoice:send',
    'payment:record',
    'payment:read',
    'report:read',
    'report:export',
    'document:upload',
    'document:read',
  ],
  ORG_ACCOUNTANT: [
    'org.profile:manage',
    'customer:read',
    'lease:read',
    'service:read',
    'meter:read',
    'invoice:create',
    'invoice:read',
    'invoice:approve',
    'invoice:send',
    'invoice:void',
    'payment:record',
    'payment:read',
    'payment:refund',
    'report:read',
    'report:export',
    'document:read',
    'document:upload',
  ],
  ORG_STAFF: [
    'property:read',
    'customer:create',
    'customer:read',
    'customer:update',
    'lease:read',
    'service:read',
    'meter:read',
    'meter:create',
    'meterreading:create',
    'invoice:read',
    'payment:read',
    'document:upload',
    'document:read',
  ],
  TENANT_USER: ['clientportal:access', 'invoice:read', 'payment:read', 'document:read'],
};

async function seedRolesAndPermissions(): Promise<void> {
  logger.info('Seeding roles and permissions...');

  for (const role of PLATFORM_ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description, isPlatformRole: role.isPlatformRole },
      create: { ...role },
    });
    logger.info(`  Role: ${role.name}`);
  }

  for (const perm of PLATFORM_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: { description: perm.description },
      create: { ...perm },
    });
  }
  logger.info(`  Permissions: ${PLATFORM_PERMISSIONS.length} total`);

  for (const [roleName, permNames] of Object.entries(ROLE_PERMISSION_MAP)) {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) continue;
    for (const permName of permNames) {
      const permission = await prisma.permission.findUnique({ where: { name: permName } });
      if (!permission) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
    logger.info(`  Role ${roleName}: linked ${permNames.length} permissions`);
  }
}

async function seedSubscriptionPlans(): Promise<void> {
  logger.info('Seeding subscription plans...');

  const plans = [
    {
      name: 'STARTER',
      description:
        'Starter plan for independent landlords and small property managers (up to 50 units)',
      price: 29.0,
      currency: 'USD',
      interval: SubscriptionInterval.MONTHLY,
      features: {
        maxProperties: 10,
        maxUnits: 50,
        maxCustomers: 200,
        billingFrequency: true,
        invoiceCustomBranding: false,
        apiAccess: false,
        supportLevel: 'standard',
        reports: ['basic'],
      },
    },
    {
      name: 'PROFESSIONAL',
      description: 'Professional plan for growing property management businesses',
      price: 99.0,
      currency: 'USD',
      interval: SubscriptionInterval.MONTHLY,
      features: {
        maxProperties: 100,
        maxUnits: 500,
        maxCustomers: 2000,
        billingFrequency: true,
        invoiceCustomBranding: true,
        apiAccess: true,
        supportLevel: 'priority',
        reports: ['basic', 'financial', 'analytics'],
      },
    },
    {
      name: 'ENTERPRISE',
      description: 'Enterprise plan for large organizations with unlimited units',
      price: 299.0,
      currency: 'USD',
      interval: SubscriptionInterval.MONTHLY,
      features: {
        maxProperties: -1,
        maxUnits: -1,
        maxCustomers: -1,
        billingFrequency: true,
        invoiceCustomBranding: true,
        apiAccess: true,
        supportLevel: 'dedicated',
        reports: ['basic', 'financial', 'analytics', 'custom'],
        sso: true,
        dedicatedAccountManager: true,
      },
    },
    {
      name: 'STARTER_ANNUAL',
      description: 'Annual Starter plan - 2 months free',
      price: 290.0,
      currency: 'USD',
      interval: SubscriptionInterval.ANNUALLY,
      features: {
        maxProperties: 10,
        maxUnits: 50,
        maxCustomers: 200,
        billingFrequency: true,
        invoiceCustomBranding: false,
        apiAccess: false,
        supportLevel: 'standard',
        reports: ['basic'],
        annual: true,
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

async function seedPlatformAdmin(): Promise<void> {
  logger.info('Seeding platform admin user...');

  const adminEmail = env.PLATFORM_ADMIN_EMAIL;
  const adminPassword = env.PLATFORM_ADMIN_PASSWORD ?? 'PlatformAdmin123!';

  if (!adminEmail) {
    logger.warn('  PLATFORM_ADMIN_EMAIL not set; skipping platform admin seed');
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const user = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { name: 'Platform Administrator', passwordHash },
    create: {
      email: adminEmail,
      name: 'Platform Administrator',
      passwordHash,
      emailVerified: new Date(),
    },
  });

  const platformAdminRole = await prisma.role.findUnique({ where: { name: 'PLATFORM_ADMIN' } });

  logger.info(`  Platform admin user: ${user.id} (${user.email})`);

  if (platformAdminRole) {
    await prisma.organizationMember
      .upsert({
        where: {
          organizationId_userId: {
            organizationId: '00000000-0000-0000-0000-000000000000' as string & {
              readonly __brand: unique symbol;
              readonly __type: 'OrganizationId';
            },
            userId: user.id,
          },
        },
        update: { roleId: platformAdminRole.id },
        create: {
          organizationId: '00000000-0000-0000-0000-000000000000' as string & {
            readonly __brand: unique symbol;
            readonly __type: 'OrganizationId';
          },
          userId: user.id,
          roleId: platformAdminRole.id,
        },
      })
      .catch(() => {
        logger.warn('  Skipping platform admin org membership (org not yet created - expected');
      });
  }
}

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
      nextInvoiceNumber: 1,
    },
  });

  const ownerPassword = await bcrypt.hash('DemoOwner123!', 12);
  const owner = await prisma.user.upsert({
    where: { email: 'owner@demopm.com' },
    update: { name: 'Demo Owner', passwordHash: ownerPassword },
    create: {
      email: 'owner@demopm.com',
      name: 'Demo Owner',
      passwordHash: ownerPassword,
      emailVerified: new Date(),
    },
  });

  const orgOwnerRole = await prisma.role.findUnique({ where: { name: 'ORG_OWNER' } });
  if (orgOwnerRole) {
    await prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: demoOrg.id, userId: owner.id } },
      update: { roleId: orgOwnerRole.id },
      create: { organizationId: demoOrg.id, userId: owner.id, roleId: orgOwnerRole.id },
    });
  }

  const profPlan = await prisma.subscriptionPlan.findUnique({ where: { name: 'PROFESSIONAL' } });
  if (profPlan) {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1);
    await prisma.organizationSubscription.upsert({
      where: { organizationId: demoOrg.id },
      update: { planId: profPlan.id, status: SubscriptionStatus.ACTIVE },
      create: {
        organizationId: demoOrg.id,
        planId: profPlan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: endDate,
      },
    });
  }

  logger.info(`  Demo org: ${demoOrg.id} (owner: ${owner.email})`);
}

async function main(): Promise<void> {
  logger.info('==================================================');
  logger.info('myTenant Invoice - Database Seeding');
  logger.info('==================================================');

  await seedRolesAndPermissions();
  await seedSubscriptionPlans();
  await seedPlatformAdmin();
  await seedSampleOrganization();

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
