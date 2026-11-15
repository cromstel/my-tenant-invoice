import { redirect } from 'next/navigation';

import { ORG_ROLES } from '@/config/roles';
import { type CurrentUser, getCurrentUser } from '@/lib/auth';

/**
 * Returns the current user, redirecting to the login page when anonymous.
 * The proxy middleware already enforces this; the guard keeps direct
 * renders (e.g. during development or future route changes) safe.
 */
export async function requireActiveSession(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');
  return user;
}

/**
 * Guard for management pages: the user must hold an organization role in
 * the active tenant. Tenant-only users are sent to the client portal.
 */
export async function requireOrgUser(): Promise<CurrentUser> {
  const user = await requireActiveSession();
  const orgId = user.activeTenantId;
  if (!orgId) return user;
  const roles = user.roles[orgId] ?? [];
  const hasOrgRole = roles.some((role) => (ORG_ROLES as readonly string[]).includes(role));
  if (!hasOrgRole) redirect('/portal');
  return user;
}

/**
 * Guard for the client portal: the active tenant role must be TENANT_USER.
 * Management roles are sent to the dashboard instead.
 */
export async function requireTenantUser(): Promise<CurrentUser> {
  const user = await requireActiveSession();
  const orgId = user.activeTenantId;
  if (orgId) {
    const roles = user.roles[orgId] ?? [];
    if (!roles.includes('TENANT_USER')) redirect('/dashboard');
  }
  return user;
}

/**
 * Guard for platform administration pages.
 */
export async function requirePlatformAdmin(): Promise<CurrentUser> {
  const user = await requireActiveSession();
  const isPlatformAdmin = Object.values(user.roles).some((roles) =>
    roles.includes('PLATFORM_ADMIN'),
  );
  if (!isPlatformAdmin) redirect('/dashboard');
  return user;
}
