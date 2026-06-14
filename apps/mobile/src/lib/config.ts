/**
 * Mobile environment configuration for @crm/mobile.
 *
 * Reads `EXPO_PUBLIC_*` env vars (Expo SDK 53 inlines these into the bundle
 * at build time via babel-preset-expo) and validates them through the shared,
 * platform-agnostic `parseEnv()` from `@crm/config`.
 *
 * Required `.env` (or `eas env`) variables for the spike:
 *   EXPO_PUBLIC_CONVEX_URL       — e.g. https://happy-anvil-123.convex.cloud
 *   EXPO_PUBLIC_CONVEX_SITE_URL  — Convex site URL (auth.config.ts domain)
 *   EXPO_PUBLIC_SITE_URL         — Better Auth baseURL (the web app origin)
 *
 * NOTE: BETTER_AUTH_SECRET is server-only and is intentionally NOT read here.
 */
import { parseEnv, type Env } from '@crm/config';

function readEnv(): Record<string, string | undefined> {
  // On native, Expo only exposes vars prefixed with EXPO_PUBLIC_. Map them
  // onto the platform-agnostic names defined by @crm/config.
  return {
    CONVEX_URL: process.env.EXPO_PUBLIC_CONVEX_URL,
    CONVEX_SITE_URL: process.env.EXPO_PUBLIC_CONVEX_SITE_URL,
    SITE_URL: process.env.EXPO_PUBLIC_SITE_URL,
    NODE_ENV: process.env.NODE_ENV,
    // The shared schema marks BETTER_AUTH_SECRET required (server-side guard).
    // The mobile client never uses it, so stub it to satisfy validation.
    BETTER_AUTH_SECRET:
      process.env.EXPO_PUBLIC_BETTER_AUTH_SECRET_STUB ?? 'mobile-client-not-server',
  };
}

let cached: Env | null = null;

/**
 * Validated mobile environment. Throws at first access if required vars are
 * missing — fail fast rather than silently hitting an undefined Convex URL.
 */
export function mobileEnv(): Env {
  if (cached) return cached;
  cached = parseEnv(readEnv());
  return cached;
}
