'use client';

import { useCurrentUser } from '@/lib/convex/hooks/useCurrentUser';
import { useAuthQuery } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { useMemo } from 'react';

/**
 * Returns the full permission map for the current user in their active org.
 * Keys are "feature:action" strings, values are booleans.
 */
export function usePermissions(): Record<string, boolean> {
  const { perms } = usePermissionsWithStatus();
  return perms;
}

/**
 * Returns permissions plus loading state.
 */
export function usePermissionsWithStatus(): {
  perms: Record<string, boolean>;
  isLoading: boolean;
} {
  const user = useCurrentUser();
  const orgId = user?.activeOrganization?.id;

  const { data, isLoading } = useAuthQuery(
    api.permissionQueries.getMyPermissions as any,
    orgId ? {} : 'skip',
    {}
  );

  const perms = useMemo(() => data ?? {}, [data]);
  return { perms, isLoading };
}

/**
 * Check a single permission (feature + action).
 */
export function usePermission(feature: string, action: string): boolean {
  const perms = usePermissions();
  return perms[`${feature}:${action}`] ?? false;
}

/**
 * Check if the user has ANY of the given permissions.
 */
export function useAnyPermission(checks: [string, string][]): boolean {
  const perms = usePermissions();
  return checks.some(([f, a]) => perms[`${f}:${a}`] ?? false);
}
