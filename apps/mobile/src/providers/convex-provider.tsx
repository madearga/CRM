/**
 * Convex provider for the mobile app.
 *
 * Thin wrapper around `convex/react`'s `<ConvexProvider>` that installs the
 * Better Auth token fetcher on the shared {@link convexClient} and keeps it
 * in sync with the auth session lifecycle.
 *
 * ## Why this subscribes to auth status (cold-start fix)
 *
 * A previous version called `convexClient.setAuth(exchangeConvexToken)` once
 * on mount. On a cold start Better Auth's reactive session atom is still
 * revalidating the stored cookie, so the token exchange returned `null` and
 * Convex stayed unauthenticated even though a valid session existed in secure
 * storage. To close that gap, this provider re-subscribes to the auth machine:
 *
 *  - `authenticated` → (re)install `setAuth(exchangeConvexToken)` so Convex
 *    handshakes with a freshly-minted token, both after the cold-start
 *    session resolves and after an interactive sign-in.
 *  - `unauthenticated` → `clearAuth()` so queries stop acting as the
 *    just-signed-out user.
 *
 * `setAuth` is idempotent for the same client, so re-calling it on each
 * `authenticated` transition is safe and cheap.
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
import { useAuth } from '@/hooks/use-auth';

export function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status } = useAuth();

  // Drive the Convex auth connection from the auth state machine. Installing
  // the fetcher only once the session is confirmed `authenticated` fixes the
  // cold-start race where an unresolved Better Auth session left Convex
  // unauthenticated despite a valid stored token.
  React.useEffect(() => {
    if (status === 'authenticated') {
      convexClient.setAuth(exchangeConvexToken);
      return;
    }
    if (status === 'unauthenticated') {
      // Drop the auth connection so live queries stop acting as the
      // signed-out user. Guarded so a throw can never break navigation.
      try {
        convexClient.clearAuth();
      } catch {
        /* ignore — Convex will re-handshake on next authenticated transition */
      }
    }
    // `signingIn` / `signingOut` / `initializing` intentionally leave the
    // existing connection untouched until the next terminal status.
  }, [status]);

  return <ConvexProvider client={convexClient}>{children}</ConvexProvider>;
}
