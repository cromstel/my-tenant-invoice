'use client';

import { authClient } from "@/lib/auth-client";

/**
 * Returns the current authenticated user or null.
 */
export function useCurrentUser() {
  const { data: session, isPending } = authClient.useSession();
  return {
    user: session?.user ?? null,
    isLoading: isPending,
    isAuthenticated: !!session?.user,
  };
}
