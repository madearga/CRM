/**
 * Mobile Convex client configured with Better Auth token exchange.
 *
 * The provider pattern is intentionally thin: we create a single
 * `ConvexReactClient` from `convex/react` (RN-safe, no `convex/browser` import),
 * then feed it an async token fetcher. The fetcher asks Better Auth for a
 * fresh Convex JWT on every authentication handshake and before token expiry.
 *
 * This mirrors what `@convex-dev/better-auth/react`'s
 * `ConvexBetterAuthProvider` does, but avoids its `window.location` OTT logic
 * and lets us plug `expo-secure-store` for session persistence.
 */
import React, { useEffect, useState } from 'react';
import { ConvexReactClient, ConvexProvider } from 'convex/react';

import { fetchConvexToken } from '@crm/auth';

import { authClient } from './auth-client';
import { mobileEnv } from './config';

/**
 * Shared `ConvexReactClient` instance. Lives outside React so that any
 * remounts of the provider reuse the same underlying WebSocket connection.
 */
export const convexClient = new ConvexReactClient(mobileEnv().CONVEX_URL, {
  verbose: false,
});

/**
 * React Native provider that wires the Convex client to Better Auth.
 *
 * On mount it installs the token fetcher via `client.setAuth()`. The fetcher
 * returns `null` when the user is not signed in, which makes Convex treat the
 * connection as unauthenticated. When the user signs in/out the Convex client
 * is notified via the optional `onChange` callback so queries refetch with
 * the correct identity.
 */
export function MobileConvexProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    convexClient.setAuth(
      async ({ forceRefreshToken }) => {
        // Better Auth's /convex/token endpoint always mints a fresh JWT for
        // the active session, so forceRefreshToken is implicitly handled.
        void forceRefreshToken;
        return fetchConvexToken(authClient);
      },
      (authenticated) => {
        setIsAuthenticated(authenticated);
      },
    );
  }, []);

  return (
    <ConvexProvider client={convexClient}>
      {children}
    </ConvexProvider>
  );
}
