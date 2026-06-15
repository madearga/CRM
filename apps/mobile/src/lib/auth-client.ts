/**
 * Mobile Better Auth client (React flavour).
 *
 * Production version of the U0 spike client. Uses `better-auth/react` (NOT
 * `@convex-dev/better-auth/react`) for the reactive `useSession` atom binding
 * — this is RN-safe (no `react-dom` / `window` / `document`).
 *
 * ## Single source of truth for plugins
 *
 * The plugin set is built by the shared {@link crmAuthClientPlugins} factory
 * in `@crm/auth`, so the React Native client can never silently drift out of
 * sync with the web/server client. We cannot reuse `createCrmAuthClient`
 * directly because it builds from `better-auth/client` (agnostic, no react
 * hook) — and mobile needs the reactive `useSession` hook that only
 * `better-auth/react`'s `createAuthClient` wires up. Instead we hand the
 * shared plugin array to the React client builder. Constants
 * (`storagePrefix`) come from `@crm/config` via the shared factory, so both
 * clients stay in sync.
 *
 * Persistence:
 *  - `crossDomainClient({ storage: secureAuthStorage })` persists the session
 *    cookie + session data via `expo-secure-store`
 *    (`whenUnlockedThisDeviceOnly`, see secure-storage.ts).
 *
 * @see docs/plans/2026-06-14-001-feat-mobile-crm-react-native-plan.md U3
 */
import { createAuthClient } from 'better-auth/react';

import { crmAuthClientPlugins } from '@crm/auth';

import { mobileEnv } from './config';
import { secureAuthStorage } from './secure-storage';

export const authClient = createAuthClient({
  baseURL: mobileEnv().SITE_URL,
  plugins: crmAuthClientPlugins({ storage: secureAuthStorage }),
});

/** Max wait for the Convex token handshake before we give up and treat the
 * session as unauthenticated. Keeps a stalled network from hanging the
 * Convex client's auth flow indefinitely. */
export const CONVEX_TOKEN_TIMEOUT_MS = 12_000;

/**
 * Mint a fresh Convex JWT for the active Better Auth session.
 *
 * `authClient.convex.token()` hits the server-side `/convex/token` endpoint
 * (added by the `convex` server plugin). It returns `{ data: { token }, error }`
 * on success or `{ data: null, error }` when there is no session / the session
 * is expired. We normalise both shapes into `string | null`.
 *
 * A timeout guards against a hung network leaving the Convex client's auth
 * handshake pending forever. The losing promise is always caught (same
 * race-safety pattern as {@link '../lib/network'.probeNetwork}) so a late
 * resolution/rejection can never surface as an unhandled rejection.
 *
 * This replaces the throwaway `fetchConvexToken` reference the spike imported
 * from `@crm/auth` (which was never actually exported there).
 */
export async function exchangeConvexToken(): Promise<string | null> {
  const tokenPromise = authClient.convex.token();
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error('convex-token-timeout')),
      CONVEX_TOKEN_TIMEOUT_MS,
    );
  });

  // Race safety: swallow the losing competitor's rejection so it can never
  // surface as an unhandled rejection. The `Promise.race` below decides.
  tokenPromise.catch(() => {});
  timeoutPromise.catch(() => {});

  try {
    const result = await Promise.race([tokenPromise, timeoutPromise]);
    if (result.error) return null;
    return result.data?.token ?? null;
  } catch {
    // Timeout, transport error, or thrown token call — treat as no token.
    return null;
  }
}

// Re-export the hooks/actions the provider + screens consume.
export const { signIn, signOut, signUp, useSession } = authClient;
