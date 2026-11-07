import { headers } from "next/headers";
import { auth } from "@/lib/better-auth";
import { ROLE_PERMISSIONS, type RoleName } from "@/config/roles";
import { AuthorizationError } from "@/lib/errors";

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  activeTenantId: string | null;
  roles: Record<string, string[]>;
  impersonatedTenantId: string | null;
  impersonatedBy: string | null;
};

/**
 * Returns the current authenticated user from the Better Auth session.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return null;
    const user = session.user as Record<string, unknown>;
    return {
      id: user.id as string,
      email: (user.email as string) ?? "",
      name: (user.name as string) ?? null,
      image: (user.image as string) ?? null,
      activeTenantId: (user.activeTenantId as string) ?? null,
      roles: (user.roles as Record<string, string[]>) ?? {},
      impersonatedTenantId: (user.impersonatedTenantId as string) ?? null,
      impersonatedBy: (user.impersonatedBy as string) ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Returns the current session or throws if not authenticated.
 */
export async function requireSession(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError("Authentication required");
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
  return userRoles.some((role) => {
    const perms = ROLE_PERMISSIONS[role as RoleName] ?? [];
    return perms.includes(permission);
  });
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
    if (user.roles[orgId]?.includes("PLATFORM_ADMIN")) return true;
  }
  return false;
}

/**
 * Returns true if the current session is impersonating a tenant.
 */
export function isImpersonating(user: { impersonatedTenantId?: string | null }): boolean {
  return Boolean(user?.impersonatedTenantId);
}
