/**
 * Mobile Better Auth client.
 *
 * Throwaway U0 spike client. For production code this should be built from the
 * shared {@link createCrmAuthClient} factory in `@crm/auth`; the spike inlines
 * the plugin configuration to keep the proof-of-concept self-contained.
 *
 * Uses:
 *  - `better-auth/react` (NOT `@convex-dev/better-auth/react`): RN-safe
 *    react/nanostores binding, no `react-dom` / `window` / `document`.
 *  - `crossDomainClient` with an `expo-secure-store` adapter so the session
 *    cookie survives app restarts.
 *  - `convexClient` to expose `authClient.convex.token()`.
 */
import { createAuthClient } from 'better-auth/react';
import { convexClient, crossDomainClient } from '@convex-dev/better-auth/client/plugins';
import { inferAdditionalFields } from 'better-auth/client/plugins';

import { DEFAULT_AUTH_STORAGE_PREFIX } from '@crm/config';

import { mobileEnv } from './config';
import { secureAuthStorage } from './secure-storage';

export const authClient = createAuthClient({
  baseURL: mobileEnv().SITE_URL,
  plugins: [
    inferAdditionalFields(),
    crossDomainClient({
      storage: secureAuthStorage,
      storagePrefix: DEFAULT_AUTH_STORAGE_PREFIX,
    }),
    convexClient(),
  ],
});

// Re-export the hooks/actions the spike screen consumes.
export const { signIn, signOut, signUp, useSession } = authClient;
