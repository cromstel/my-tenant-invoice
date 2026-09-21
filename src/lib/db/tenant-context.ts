import { AsyncLocalStorage } from "node:async_hooks";
import type { OrganizationId, UserId } from "@/lib/types/brands";
import {
  MissingTenantContextError,
  InternalError,
} from "@/lib/errors";

export type TenantContextValue = {
  organizationId: OrganizationId | null;
  userId: UserId | null;
  isPlatformCall: boolean;
  impersonatedBy: UserId | null;
  traceId: string | null;
};

const DEFAULT_CONTEXT: TenantContextValue = {
  organizationId: null,
  userId: null,
  isPlatformCall: false,
  impersonatedBy: null,
  traceId: null,
};

const tenantStorage = new AsyncLocalStorage<TenantContextValue>();

export function getTenantContext(): TenantContextValue {
  return tenantStorage.getStore() ?? { ...DEFAULT_CONTEXT };
}

export function getRequiredOrganizationId(): OrganizationId {
  const ctx = getTenantContext();
  if (!ctx.organizationId) {
    throw new MissingTenantContextError(undefined, {
      context: {
        hasUserId: Boolean(ctx.userId),
        isPlatformCall: ctx.isPlatformCall,
        traceId: ctx.traceId,
      },
    });
  }
  return ctx.organizationId;
}

export function getOptionalOrganizationId(): OrganizationId | null {
  return getTenantContext().organizationId;
}

export async function setTenantContext<T>(
  ctx: Partial<TenantContextValue>,
  fn: () => Promise<T> | T
): Promise<T> {
  const current = getTenantContext();
  const merged: TenantContextValue = {
    organizationId:
      ctx.organizationId !== undefined ? ctx.organizationId : current.organizationId,
    userId: ctx.userId !== undefined ? ctx.userId : current.userId,
    isPlatformCall:
      ctx.isPlatformCall !== undefined ? ctx.isPlatformCall : current.isPlatformCall,
    impersonatedBy:
      ctx.impersonatedBy !== undefined ? ctx.impersonatedBy : current.impersonatedBy,
    traceId: ctx.traceId !== undefined ? ctx.traceId : current.traceId,
  };
  const result = await tenantStorage.run(merged, () => fn());
  return result;
}

export function isPlatformContext(): boolean {
  return getTenantContext().isPlatformCall;
}

export async function runAsPlatform<T>(
  fn: () => Promise<T> | T
): Promise<T> {
  const ctx = getTenantContext();
  if (ctx.organizationId) {
    throw new InternalError(
      "runAsPlatform called within a tenant-scoped context",
      {
        context: {
          organizationId: ctx.organizationId,
          traceId: ctx.traceId,
        },
      }
    );
  }
  return setTenantContext({ isPlatformCall: true }, fn);
}
