/**
 * Role names used across the platform.
 */
export type RoleName =
  | 'PLATFORM_ADMIN'
  | 'PLATFORM_SUPPORT'
  | 'ORG_OWNER'
  | 'ORG_ADMIN'
  | 'ORG_ACCOUNTANT'
  | 'ORG_STAFF'
  | 'TENANT_USER';

/**
 * Permissions granularity - action:resource.
 */
export type Permission = string;

/**
 * Maps each role to its set of permissions.
 */
export const ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  PLATFORM_ADMIN: ['*'],
  PLATFORM_SUPPORT: ['platform.read', 'platform.support'],
  ORG_OWNER: ['org.*'],
  ORG_ADMIN: [
    'org.read',
    'org.update',
    'property.*',
    'customer.*',
    'lease.*',
    'service.*',
    'tariff.*',
    'meter.*',
    'invoice.*',
    'payment.*',
    'notification.*',
    'report.*',
    'team.read',
    'team.invite',
  ],
  ORG_ACCOUNTANT: [
    'invoice.read',
    'invoice.create',
    'invoice.update',
    'invoice.send',
    'payment.*',
    'credit_note.*',
    'report.*',
    'billing.*',
  ],
  ORG_STAFF: [
    'property.read',
    'customer.read',
    'lease.read',
    'meter.read',
    'meter.create',
    'invoice.read',
  ],
  TENANT_USER: ['portal.read', 'portal.pay'],
};

/**
 * Returns whether a role includes a permission (supports wildcards).
 */
export function roleHasPermission(role: RoleName, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role] ?? [];
  return perms.some((p) => {
    if (p === '*' || p === permission) return true;
    // Wildcard support: org.* matches org.read, org.update, etc.
    if (p.endsWith('.*')) {
      const prefix = p.slice(0, -2);
      return permission.startsWith(prefix + '.') || permission === prefix;
    }
    return false;
  });
}

export const ORG_ROLES: RoleName[] = ['ORG_OWNER', 'ORG_ADMIN', 'ORG_ACCOUNTANT', 'ORG_STAFF'];
export const PLATFORM_ROLES: RoleName[] = ['PLATFORM_ADMIN', 'PLATFORM_SUPPORT'];
