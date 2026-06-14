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

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  // Install the auth token fetcher exactly once. `setAuth` is idempotent for
  // the same client: re-calling it on a remount just refreshes the handler.
  React.useEffect(() => {
    convexClient.setAuth(exchangeConvexToken);
  }, []);

  return <ConvexProvider client={convexClient}>{children}</ConvexProvider>;
}
