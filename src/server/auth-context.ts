import prisma from '@/lib/db/prisma';
import { runAsPlatform } from '@/lib/db/tenant-context';

/**
 * Cookie that carries the organization a user is currently working in.
 */
export const ACTIVE_TENANT_COOKIE = 'active-tenant-id';

export type TenantMembership = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  roleNames: string[];
};

export type AuthContext = {
  userId: string;
  email: string;
  name: string | null;
  image: string | null;
  /** Organization the user is currently working in, or null when they have none. */
  activeTenantId: string | null;
  /** Role names per organization id, e.g. `{ 'org_1': ['ORG_OWNER'] }`. */
  roles: Record<string, string[]>;
  /** Non-platform memberships, i.e. the organizations the user belongs to. */
  tenantMemberships: TenantMembership[];
  /** True when the user holds the PLATFORM_ADMIN role. */
  isPlatformAdmin: boolean;
};

type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
};

/**
 * Picks the organization a request should act on.
 *
 * The requested tenant only wins when the user actually belongs to it;
 * otherwise the first membership is used so a stale cookie can never widen
 * access.
 */
export function pickActiveTenantId(
  memberships: readonly TenantMembership[],
  requestedTenantId?: string | null,
): string | null {
  if (requestedTenantId) {
    const requested = memberships.find((m) => m.organizationId === requestedTenantId);
    if (requested) return requested.organizationId;
  }
  return memberships[0]?.organizationId ?? null;
}

/**
 * Loads the role and tenant context for a signed-in user.
 *
 * Roles live in `organizationMember`/`role`, not on the session row, so they
 * are read here instead of being copied into the session on every sign-in.
 * The read runs as a platform call because the tenant it needs to scope the
 * request to is exactly what this lookup determines.
 */
export async function loadAuthContext(
  user: SessionUser,
  requestedTenantId?: string | null,
): Promise<AuthContext> {
  const memberships = await runAsPlatform(() =>
    prisma.organizationMember.findMany({
      where: { userId: user.id },
      include: {
        role: { select: { name: true, isPlatformRole: true } },
        organization: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
  );

  const roles: Record<string, string[]> = {};
  const tenantMemberships: TenantMembership[] = [];
  let isPlatformAdmin = false;

  for (const membership of memberships) {
    const roleNames = roles[membership.organizationId] ?? [];
    roles[membership.organizationId] = [...roleNames, membership.role.name];

    if (membership.role.isPlatformRole) {
      if (membership.role.name === 'PLATFORM_ADMIN') isPlatformAdmin = true;
      continue;
    }

    tenantMemberships.push({
      organizationId: membership.organizationId,
      organizationName: membership.organization.name,
      organizationSlug: membership.organization.slug,
      roleNames: [membership.role.name],
    });
  }

  return {
    userId: user.id,
    email: user.email,
    name: user.name ?? null,
    image: user.image ?? null,
    activeTenantId: pickActiveTenantId(tenantMemberships, requestedTenantId),
    roles,
    tenantMemberships,
    isPlatformAdmin,
  };
}
