/**
 * U2 cross-package import probe for @crm/mobile.
 *
 * Purpose: prove that the platform-agnostic shared packages
 * (`@crm/config`, `@crm/auth`) are importable from a React Native / Expo
 * bundle WITHOUT pulling in web-only dependencies. This is NOT an auth
 * provider — full mobile auth/Convex providers are built in U3.
 *
 * If `pnpm typecheck` (apps/mobile) passes while this file exists, the U2
 * deliverable "mobile can import both" is satisfied.
 */
import {
  parseEnv,
  envSchema,
  type Env,
  APP_NAME,
  AUTH_STORAGE_KEYS,
  DEFAULT_SITE_URL,
} from '@crm/config';

import {
  createCrmAuthClient,
  type CrmAuthClient,
  type CrmAuthStorage,
  type SessionUser,
  type SessionState,
  type EmailSignInInput,
} from '@crm/auth';

/**
 * Parse the mobile runtime config (Expo `Constants.expoConfig.extra` in U3)
 * through the shared Zod schema. Kept lazy and side-effect free: importing
 * this module never touches `process.env`.
 */
export function buildMobileEnv(extra: Record<string, string | undefined>): Env {
  return parseEnv(extra);
}

/**
 * A platform-agnostic reference to the auth client factory. Mobile providers
 * (U3) call this with an `expo-secure-store`-backed {@link CrmAuthStorage}.
 */
export function buildMobileAuthClient(
  baseURL: string,
  storage: CrmAuthStorage,
): CrmAuthClient {
  return createCrmAuthClient({ baseURL, storage });
}

// Re-export the shared types so mobile consumers can import from one place.
export type {
  Env,
  CrmAuthClient,
  CrmAuthStorage,
  SessionUser,
  SessionState,
  EmailSignInInput,
};

export { envSchema, APP_NAME, AUTH_STORAGE_KEYS, DEFAULT_SITE_URL };
