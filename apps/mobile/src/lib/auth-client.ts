/**
 * Mobile Better Auth client (React flavour) — native Expo flow.
 *
 * Uses `better-auth/react` for the reactive `useSession` atom (RN-safe, no
 * react-dom/window). Persistence + OAuth state handling for native mobile is
 * provided by `expoClient` from `@better-auth/expo/client`:
 *  - Stores the session cookie in `expo-secure-store` (keychain).
 *  - Provides the `/expo-authorization-proxy`-aware flow that sets the OAuth
 *    state cookie server-side before redirecting to Google, so the browser
 *    callback can verify state (fixes `state_mismatch` on native).
 *  - Opens the browser for social sign-in and captures the cookie from the
 *    `crmmobile://` deep-link return automatically.
 *
 * `expoClient` and `crossDomainClient` are mutually exclusive; native mobile
 * uses `expoClient`. Web (Expo Web) would use `crossDomainClient` instead.
 *
 * @see https://labs.convex.dev/better-auth/framework-guides/expo
 */
import { createAuthClient } from 'better-auth/react';
import { expoClient } from '@better-auth/expo/client';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

import { crmAuthClientPlugins } from '@crm/auth';
import { DEFAULT_AUTH_STORAGE_PREFIX } from '@crm/config';

import { mobileEnv } from './config';

const SCHEME = (Constants.expoConfig?.scheme as string | undefined) ?? 'crmmobile';

export const authClient = createAuthClient({
  // Mobile calls the public Convex site where Better Auth routes are mounted
  // (`/api/auth/*`). localhost is the phone itself on a physical iPhone.
  baseURL: mobileEnv().CONVEX_SITE_URL,
  plugins: crmAuthClientPlugins({
    // expoClient handles native cookie storage + the OAuth state proxy flow.
    // Do NOT pass `storage` (that would add crossDomainClient, which is for
    // web and is mutually exclusive with expoClient).
    plugins: [
      expoClient({
        scheme: SCHEME,
        storagePrefix: DEFAULT_AUTH_STORAGE_PREFIX,
        storage: SecureStore,
      }),
    ],
  }),
});

type ConvexTokenResult = {
  data?: { token?: string | null } | null;
  error?: unknown;
};

type ConvexTokenClient = typeof authClient & {
  convex: {
    token: () => Promise<ConvexTokenResult>;
  };
};

const convexAuthClient = authClient as ConvexTokenClient;

/** Max wait for the Convex token handshake before we give up and treat the
 * session as unauthenticated. Keeps a stalled network from hanging the
 * Convex client's auth flow indefinitely. */
export const CONVEX_TOKEN_TIMEOUT_MS = 12_000;

/**
 * Mint a fresh Convex JWT for the active Better Auth session.
 *
 * `authClient.convex.token()` hits the server-side `/convex/token` endpoint
 * (added by the `convex` server plugin). We normalise the result into
 * `string | null`; a timeout guards against a hung network.
 */
export async function exchangeConvexToken(): Promise<string | null> {
  const tokenPromise = convexAuthClient.convex.token();
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