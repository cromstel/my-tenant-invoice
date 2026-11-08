import { Prisma, type PrismaClient } from '@prisma/client';

import { getOptionalOrganizationId, isPlatformContext } from '@/lib/db/tenant-context';
import { MissingTenantContextError, TenantMismatchError } from '@/lib/errors';
import type { OrganizationId } from '@/lib/types/brands';

export const TENANT_SCOPED_MODELS: string[] = [
  'Organization',
  'OrganizationMember',
  'Portfolio',
  'Property',
  'Building',
  'Unit',
  'Customer',
  'CustomerContact',
  'Lease',
  'Service',
  'ServicePackage',
  'ServicePackageItem',
  'Tariff',
  'TariffVersion',
  'Meter',
  'MeterReading',
  'BillingCycle',
  'Invoice',
  'InvoiceItem',
  'CreditNote',
  'CreditNoteItem',
  'Payment',
  'PaymentAllocation',
  'Refund',
  'Document',
  'Notification',
  'NotificationPreference',
  'AuditLog',
  'WebhookEndpoint',
  'WebhookEvent',
  'ApiKey',
  'Integration',
  'SupportTicket',
  'OrganizationSubscription',
];

export const MODELS_WITH_DIRECT_ORG_ID: string[] = [
  'OrganizationMember',
  'Portfolio',
  'Property',
  'Building',
  'Unit',
  'Customer',
  'Lease',
  'Service',
  'ServicePackage',
  'Tariff',
  'Meter',
  'BillingCycle',
  'Invoice',
  'CreditNote',
  'Payment',
  'Document',
  'Notification',
  'NotificationPreference',
  'AuditLog',
  'WebhookEndpoint',
  'ApiKey',
  'Integration',
  'SupportTicket',
  'OrganizationSubscription',
];

export const PLATFORM_LOOKUP_MODELS: string[] = [
  'User',
  'Account',
  'Session',
  'Role',
  'Permission',
  'RolePermission',
  'SubscriptionPlan',
];

const WRITE_OPERATIONS: string[] = [
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
  'executeRaw',
  'queryRaw',
  'executeRawUnsafe',
  'queryRawUnsafe',
];

const READ_OPERATIONS: string[] = [
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
];

function isTenantScopedModel(model: string | undefined): boolean {
  if (!model) return false;
  return TENANT_SCOPED_MODELS.includes(model);
}

function isPlatformLookupModel(model: string | undefined): boolean {
  if (!model) return false;
  return PLATFORM_LOOKUP_MODELS.includes(model);
}

function hasDirectOrgIdField(model: string | undefined): boolean {
  if (!model) return false;
  return MODELS_WITH_DIRECT_ORG_ID.includes(model);
}

function isWriteOperation(operation: string): boolean {
  return WRITE_OPERATIONS.includes(operation);
}

function isReadOperation(operation: string): boolean {
  return READ_OPERATIONS.includes(operation);
}

function isRawOperation(operation: string): boolean {
  return (
    operation === 'executeRaw' ||
    operation === 'queryRaw' ||
    operation === 'executeRawUnsafe' ||
    operation === 'queryRawUnsafe'
  );
}

function injectOrgIdIntoWhere(
  where: Record<string, unknown> | undefined,
  organizationId: OrganizationId,
  model: string,
): Record<string, unknown> {
  if (model === 'Organization') {
    return { ...where, id: organizationId };
  }
  return { ...where, organizationId };
}

function injectOrgIdIntoData(
  data: Record<string, unknown> | Array<Record<string, unknown>> | undefined,
  organizationId: OrganizationId,
  model: string,
): Record<string, unknown> | Array<Record<string, unknown>> {
  if (model === 'Organization') {
    return data ?? {};
  }
  if (Array.isArray(data)) {
    return data.map((row) => ({ organizationId, ...row }));
  }
  return { organizationId, ...(data ?? {}) };
}

function verifyResultOrganizationId(
  result: unknown,
  organizationId: OrganizationId,
  model: string,
): void {
  if (result === null || result === undefined) return;
  if (Array.isArray(result)) {
    for (const row of result) {
      verifyRowOrganizationId(row, organizationId, model);
    }
  } else if (typeof result === 'object') {
    verifyRowOrganizationId(result as Record<string, unknown>, organizationId, model);
  }
}

function verifyRowOrganizationId(
  row: Record<string, unknown>,
  organizationId: OrganizationId,
  model: string,
): void {
  if (hasDirectOrgIdField(model)) {
    const rowOrgId = row.organizationId as OrganizationId | undefined;
    if (rowOrgId && rowOrgId !== organizationId) {
      throw new TenantMismatchError({
        context: {
          model,
          expectedOrgId: organizationId,
          actualOrgId: rowOrgId,
          rowId: row.id as string | undefined,
        },
      });
    }
  } else if (model === 'Organization') {
    const rowId = row.id as OrganizationId | undefined;
    if (rowId && rowId !== organizationId) {
      throw new TenantMismatchError({
        context: {
          model,
          expectedOrgId: organizationId,
          actualOrgId: rowId,
        },
      });
    }
  }
}

export const rlsExtension = Prisma.defineExtension({
  name: 'row-level-security',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const isPlatform = isPlatformContext();
        const orgId = getOptionalOrganizationId();

        if (isPlatform) {
          return (query as (a: unknown) => Promise<unknown>)(args);
        }

        if (isRawOperation(operation)) {
          if (orgId) {
            return (query as (a: unknown) => Promise<unknown>)(args);
          }
          throw new MissingTenantContextError(model ?? operation, {
            context: { operation, isRaw: true },
          });
        }

        const tenantScoped = isTenantScopedModel(model);
        const lookupModel = isPlatformLookupModel(model);

        if (orgId) {
          const modifiedArgs = { ...(args as Record<string, unknown>) };

          if (tenantScoped) {
            if (isReadOperation(operation)) {
              const existingWhere = (modifiedArgs.where ?? {}) as Record<string, unknown>;
              modifiedArgs.where = injectOrgIdIntoWhere(existingWhere, orgId, model as string);
            } else if (isWriteOperation(operation)) {
              if (operation === 'create' || operation === 'createMany') {
                if (hasDirectOrgIdField(model) || model === 'Organization') {
                  modifiedArgs.data = injectOrgIdIntoData(
                    modifiedArgs.data as
                      Record<string, unknown> | Array<Record<string, unknown>> | undefined,
                    orgId,
                    model as string,
                  );
                }
              }

              if (
                operation === 'update' ||
                operation === 'updateMany' ||
                operation === 'delete' ||
                operation === 'deleteMany' ||
                operation === 'upsert'
              ) {
                if (hasDirectOrgIdField(model) || model === 'Organization') {
                  const existingWhere = (modifiedArgs.where ?? {}) as Record<string, unknown>;
                  modifiedArgs.where = injectOrgIdIntoWhere(existingWhere, orgId, model as string);
                }
              }

              if (operation === 'upsert') {
                if (hasDirectOrgIdField(model) || model === 'Organization') {
                  const upsertArgs = modifiedArgs as {
                    create?: Record<string, unknown>;
                    update?: Record<string, unknown>;
                  };
                  if (upsertArgs.create) {
                    upsertArgs.create = injectOrgIdIntoData(
                      upsertArgs.create,
                      orgId,
                      model as string,
                    ) as Record<string, unknown>;
                  }
                  if (upsertArgs.update && hasDirectOrgIdField(model)) {
                    const updateData = upsertArgs.update;
                    if (
                      updateData &&
                      typeof updateData === 'object' &&
                      !Array.isArray(updateData)
                    ) {
                      delete (updateData as Record<string, unknown>).organizationId;
                    }
                  }
                }
              }
            }
          }

          const result = await (query as (a: unknown) => Promise<unknown>)(modifiedArgs);

          if (tenantScoped && (isReadOperation(operation) || operation === 'create')) {
            verifyResultOrganizationId(result, orgId, model as string);
          }

          return result;
        }

        if (isWriteOperation(operation)) {
          if (tenantScoped) {
            throw new MissingTenantContextError(model ?? operation, {
              context: { operation },
            });
          }
          if (!lookupModel && !model) {
            throw new MissingTenantContextError(operation, {
              context: { operation },
            });
          }
        }

        if (isReadOperation(operation)) {
          if (tenantScoped) {
            return (query as (a: unknown) => Promise<unknown>)(args);
          }
          if (lookupModel) {
            return (query as (a: unknown) => Promise<unknown>)(args);
          }
          if (!model) {
            return (query as (a: unknown) => Promise<unknown>)(args);
          }
        }

        return (query as (a: unknown) => Promise<unknown>)(args);
      },
    },
  },
});

export function applyRls(
  prismaClient: PrismaClient,
): ReturnType<(typeof prismaClient)['$extends']> {
  return prismaClient.$extends(rlsExtension);
}

export type RlsExtendedClient = ReturnType<typeof applyRls>;
