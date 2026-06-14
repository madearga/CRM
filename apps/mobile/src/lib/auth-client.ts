/**
 * Mobile Better Auth client.
 *
 * Production version of the U0 spike client. Uses `better-auth/react` (NOT
 * `@convex-dev/better-auth/react`) for the reactive `useSession` atom binding
 * — this is RN-safe (no `react-dom` / `window` / `document`).
 *
 * Reuse strategy: the plugin *set* mirrors the shared {@link createCrmAuthClient}
 * factory in `@crm/auth` (inferAdditionalFields + crossDomainClient +
 * convexClient). We cannot call that factory directly because it deliberately
 * builds from `better-auth/client` (agnostic, no react hook) — and mobile
 * needs the reactive `useSession` hook that only `better-auth/react`'s
 * `createAuthClient` wires up. Constants (`storagePrefix`) come from
 * `@crm/config` so both clients stay in sync.
 *
 * Persistence:
 *  - `crossDomainClient({ storage: secureAuthStorage })` persists the session
 *    cookie + session data via `expo-secure-store`
 *    (`whenUnlockedThisDeviceOnly`, see secure-storage.ts).
 *
 * @see docs/plans/2026-06-14-001-feat-mobile-crm-react-native-plan.md U3
 */
import { createAuthClient } from 'better-auth/react';
import { inferAdditionalFields } from 'better-auth/client/plugins';
import {
  convexClient,
  crossDomainClient,
} from '@convex-dev/better-auth/client/plugins';

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

/**
 * Mint a fresh Convex JWT for the active Better Auth session.
 *
 * `authClient.convex.token()` hits the server-side `/convex/token` endpoint
 * (added by the `convex` server plugin). It returns `{ data: { token }, error }`
 * on success or `{ data: null, error }` when there is no session / the session
 * is expired. We normalise both shapes into `string | null`.
 *
 * This replaces the throwaway `fetchConvexToken` reference the spike imported
 * from `@crm/auth` (which was never actually exported there).
 */
export async function exchangeConvexToken(): Promise<string | null> {
  const result = await authClient.convex.token();
  if (result.error) return null;
  return result.data?.token ?? null;
}

// Re-export the hooks/actions the provider + screens consume.
export const { signIn, signOut, signUp, useSession } = authClient;
