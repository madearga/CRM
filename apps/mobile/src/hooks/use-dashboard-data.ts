/**
 * Mobile dashboard data hook.
 *
 * Wraps the single consolidated `api.dashboard.mobileOverview` query so the
 * dashboard screen loads everything in one round trip (see the mobile plan's
 * "Dashboard Data Strategy" — do not mirror the web dashboard's 8+ queries).
 *
 * Return value follows `convex/react`'s `useQuery` contract:
 *  - `undefined` while the first result is in flight → render skeletons.
 *  - the `MobileOverview` payload once loaded.
 *  - throws on a server-side error (e.g. `ConvexError`) → caught by the
 *    dashboard's error boundary for inline retry. Transient network errors do
 *    NOT throw; the client keeps retrying and the value stays `undefined`
 *    (skeleton) until it succeeds.
 */
import { useQuery } from '@/hooks/use-convex';
import { api } from '@/lib/api';

export function useDashboardData() {
  return useQuery(api.dashboard.mobileOverview, {});
}

export type MobileOverview = NonNullable<ReturnType<typeof useDashboardData>>;
export type MobileActivity = MobileOverview['recentActivities'][number];
export type MobileOverdueInvoice = MobileOverview['overdueInvoices'][number];
