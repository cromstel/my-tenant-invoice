import { getCurrentUser } from '@/lib/auth';
import { getOptionalOrganizationId, getRequiredOrganizationId } from '@/lib/db/tenant-context';

/**
 * Returns the active organization ID for the current request context.
 * Throws if no tenant context is set.
 */
export async function getActiveOrganizationId(): Promise<string> {
  const ctxOrg = getOptionalOrganizationId();
  if (ctxOrg) return ctxOrg;
  const user = await getCurrentUser();
  if (user?.activeTenantId) return user.activeTenantId;
  throw new Error('No active tenant context');
}

/**
 * Returns the active organization ID or null if not set.
 */
export async function getActiveOrganizationIdOrNull(): Promise<string | null> {
  return getOptionalOrganizationId();
}

/**
 * Generates a URL-safe slug from a string.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

/**
 * Returns true if the current request is running in platform (super-admin) context.
 */
export function isPlatformContext(): boolean {
  return getRequiredOrganizationId() === null;
}
