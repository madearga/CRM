/**
 * Convex provider for the mobile app.
 *
 * Thin wrapper around `convex/react`'s `<ConvexProvider>` that installs the
 * Better Auth token fetcher on the shared {@link convexClient} via
 * `client.setAuth(...)`. The fetcher calls {@link exchangeConvexToken} on
 * every authentication handshake and before token expiry; returning `null`
 * makes Convex treat the connection as unauthenticated.
 *
 * Why not `@convex-dev/better-auth/react`'s `ConvexBetterAuthProvider`?
 * That component imports `window.location` (web-only) and assumes a
 * browser cookie store. Mobile persists the session via `expo-secure-store`,
 * so we replicate only the token-exchange handshake it needs.
 *
 * @see docs/plans/2026-06-14-001-feat-mobile-crm-react-native-plan.md U3
 */
import React from 'react';
import { ConvexProvider } from 'convex/react';

import { convexClient } from '@/lib/convex-client';
import { exchangeConvexToken } from '@/lib/auth-client';
import { useNetwork } from '@/hooks/use-network';

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  // Install the auth token fetcher exactly once. `setAuth` is idempotent for
  // the same client: re-calling it on a remount just refreshes the handler.
  React.useEffect(() => {
    convexClient.setAuth(exchangeConvexToken);
  }, []);

  // Wire in the dependency-free network listener so Convex can react to
  // connectivity changes. The ConvexReactClient WebSocket auto-reconnects on
  // its own, but this hook gives us a future seam to force an immediate retry
  // or to invalidate queries once we are back online.
  useConvexNetworkListener();

  return <ConvexProvider client={convexClient}>{children}</ConvexProvider>;
}

/**
 * Network listener for the shared Convex client.
 *
 * Today Convex's WebSocket transport handles reconnection internally, so no
 * manual intervention is required. This hook keeps the integration point small
 * and explicit: if we later want to eagerly re-authenticate or invalidate
 * cached queries on reconnect, this is the single place to add that logic.
 */
function useConvexNetworkListener() {
  const { isOnline } = useNetwork();

  React.useEffect(() => {
    if (!isOnline) return;
    // Future: force a token re-check or call a Convex reconnect helper here.
    // For U8, the auto-reconnect behavior is sufficient; the UI banner is the
    // primary feedback surface.
  }, [isOnline]);
}
