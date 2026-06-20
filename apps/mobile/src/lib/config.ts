/**
 * Mobile environment configuration for @crm/mobile.
 *
 * Reads `EXPO_PUBLIC_*` env vars (Expo SDK 53 inlines these into the bundle
 * at build time via babel-preset-expo) and validates them through the shared,
 * platform-agnostic {@link parseClientEnv} from `@crm/config`.
 *
 * Required `.env` (or `eas env`) variables for the spike:
 *   EXPO_PUBLIC_CONVEX_URL       — e.g. https://happy-anvil-123.convex.cloud
 *   EXPO_PUBLIC_CONVEX_SITE_URL  — Convex site URL (auth.config.ts domain)
 *   EXPO_PUBLIC_SITE_URL         — Better Auth baseURL (the web app origin)
 *
 * ## Security: no server secrets in the bundle
 *
 * Mobile validates against the **client-safe** schema (`parseClientEnv`),
 * which intentionally has no `BETTER_AUTH_SECRET` field. This guarantees that
 * no `EXPO_PUBLIC_BETTER_AUTH_SECRET*` variable can ever inline the shared
 * server secret into the React Native bundle. The mobile client never uses
 * the secret — it exchanges session tokens through Better Auth's server
 * endpoints — so omitting it from validation is both safe and correct.
 */
import { parseClientEnv, type ClientEnv } from '@crm/config';

function readEnv(): Record<string, string | undefined> {
  // On native, Expo only exposes vars prefixed with EXPO_PUBLIC_. Map them
  // onto the platform-agnostic names defined by @crm/config. No secret is
  // mapped here on purpose (see module docstring).
  return {
    CONVEX_URL: process.env.EXPO_PUBLIC_CONVEX_URL,
    CONVEX_SITE_URL: process.env.EXPO_PUBLIC_CONVEX_SITE_URL,
    SITE_URL: process.env.EXPO_PUBLIC_SITE_URL,
    NODE_ENV: process.env.NODE_ENV,
    GOOGLE_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    GITHUB_CLIENT_ID: process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID,
  };
}

let cached: ClientEnv | null = null;

/**
 * Validated mobile environment. Throws at first access if required vars are
 * missing — fail fast rather than silently hitting an undefined Convex URL.
 */
export function mobileEnv(): ClientEnv {
  if (cached) return cached;
  cached = parseClientEnv(readEnv());
  return cached;
}
