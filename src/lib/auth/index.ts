import { cookies, headers } from 'next/headers';
import { cache } from 'react';

import { roleHasPermission, type RoleName } from '@/config/roles';
import { auth } from '@/lib/better-auth';
import { AuthorizationError } from '@/lib/errors';
import { ACTIVE_TENANT_COOKIE, loadAuthContext } from '@/server/auth-context';

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  activeTenantId: string | null;
  activeTenantName: string | null;
  roles: Record<string, string[]>;
  impersonatedTenantId: string | null;
  impersonatedBy: string | null;
};

/**
 * Returns the current authenticated user from the Better Auth session.
 *
 * Roles and the active tenant are read from the membership tables, so a
 * role change takes effect on the next request instead of at the next sign-in.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return null;
    const user = session.user as Record<string, unknown>;
    const cookieStore = await cookies();
    const context = await loadAuthContext(
      {
        id: user.id as string,
        email: (user.email as string) ?? '',
        name: (user.name as string) ?? null,
        image: (user.image as string) ?? null,
      },
      cookieStore.get(ACTIVE_TENANT_COOKIE)?.value,
    );

    const activeTenant = context.tenantMemberships.find(
      (membership) => membership.organizationId === context.activeTenantId,
    );

    return {
      id: context.userId,
      email: context.email,
      name: context.name,
      image: context.image,
      activeTenantId: context.activeTenantId,
      activeTenantName: activeTenant?.organizationName ?? null,
      roles: context.roles,
      impersonatedTenantId: (user.impersonatedTenantId as string) ?? null,
      impersonatedBy: (user.impersonatedBy as string) ?? null,
    };
  } catch {
    return null;
  }
});

/**
 * Returns the current session or throws if not authenticated.
 */
export async function requireSession(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError('Authentication required');
  return user;
}

/**
 * Returns true if the current user has the given role in the active tenant.
 */
export async function hasRole(role: RoleName): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  if (!user.activeTenantId) return false;
  const roles = user.roles[user.activeTenantId] ?? [];
  return roles.includes(role);
}

/**
 * Returns true if the current user has any of the given roles.
 */
export async function hasAnyRole(roles: RoleName[]): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user || !user.activeTenantId) return false;
  const userRoles = user.roles[user.activeTenantId] ?? [];
  return roles.some((r) => userRoles.includes(r));
}

/**
 * Returns true if the current user has the given permission in the active tenant.
 */
export async function hasPermission(permission: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user || !user.activeTenantId) return false;
  const userRoles = user.roles[user.activeTenantId] ?? [];
  return userRoles.some((role) => roleHasPermission(role as RoleName, permission));
}

/**
 * Throws AuthorizationError if the current user does not have the given role.
 */
export async function requireRole(role: RoleName): Promise<void> {
  const ok = await hasRole(role);
  if (!ok) throw new AuthorizationError(`Requires role: ${role}`);
}

/**
 * Throws AuthorizationError if the current user does not have the given permission.
 */
export async function requirePermission(permission: string): Promise<void> {
  const ok = await hasPermission(permission);
  if (!ok) throw new AuthorizationError(`Requires permission: ${permission}`);
}

/**
 * Returns true if the current user is a platform administrator.
 */
export async function isPlatformAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  for (const orgId of Object.keys(user.roles)) {
    if (user.roles[orgId]?.includes('PLATFORM_ADMIN')) return true;
  }
  return false;
}

/**
 * Returns true if the current session is impersonating a tenant.
 */
export function isImpersonating(user: { impersonatedTenantId?: string | null }): boolean {
  return Boolean(user?.impersonatedTenantId);
}
