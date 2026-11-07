'use client';

import { authClient } from "@/lib/auth-client";

/**
 * Returns the active tenant organization for the current user.
 */
export function useTenant() {
  const { data: session } = authClient.useSession();
  const user = session?.user as { activeTenantId?: string; roles?: Record<string, string[]> } | undefined;
  return {
    activeTenantId: user?.activeTenantId ?? null,
    roles: user?.roles ?? {},
  };
}
