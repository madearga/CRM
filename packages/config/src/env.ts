import { z } from 'zod';

/**
 * Platform-agnostic environment schema.
 *
 * Validated with plain Zod (no Next.js / Vite / runtime-specific deps) so
 * both `apps/web` and `apps/mobile` can import it. The host application is
 * responsible for providing an `input` record (e.g. `process.env` on web /
 * server, or Expo `Constants.expoConfig.extra` on mobile) — this module
 * never reads environment variables at import time.
 *
 * The web app's `@t3-oss/env-nextjs`-based `env.ts` continues to own
 * `NEXT_PUBLIC_*` / `NODE_ENV` split, but can re-export or align with this
 * schema to keep a single source of truth.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('production'),

  // Convex deployment (the public URL is safe to embed in any client bundle).
  CONVEX_URL: z.string().min(1, 'CONVEX_URL is required'),
  CONVEX_SITE_URL: z
    .string()
    .min(1, 'CONVEX_SITE_URL is required')
    .default('http://localhost:3005'),

  // Public site origin. Used for OAuth redirects, deep links, etc.
  SITE_URL: z
    .string()
    .min(1)
    .optional()
    .default('http://localhost:3005'),

  // Server-side / shared secret. The Convex backend validates this; on web it
  // lives in `process.env` (server only) and must never reach the client
  // bundle. Mobile never reads it directly — it is exchanged through
  // Better Auth's server endpoints.
  BETTER_AUTH_SECRET: z.string().min(1, 'BETTER_AUTH_SECRET is required'),

  // OAuth provider public client IDs (safe to expose to the client).
  GOOGLE_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Shape of the input record passed to {@link parseEnv}. Mirrors
 * `process.env`: every value is either a string or `undefined`.
 */
export type EnvInput = Record<string, string | undefined>;

/**
 * Parse and validate an environment-variable record. Throws with a clear,
 * human-readable error message listing each invalid field on failure — this
 * is the "missing required env var throws clear error at startup" guarantee
 * the platform-agnostic packages are required to provide.
 */
export function parseEnv(input: EnvInput): Env {
  const result = envSchema.safeParse(input);
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const formatted = Object.entries(errors)
      .map(([key, msgs]) => `  - ${key}: ${(msgs ?? []).join(', ')}`)
      .join('\n');
    throw new Error(
      `Invalid environment variables:\n${formatted || '  (unknown validation error)'}`,
    );
  }
  return result.data;
}

/**
 * Non-throwing variant of {@link parseEnv}. Returns a `safeParse` result so
 * callers can decide how to surface validation issues.
 */
export function safeParseEnv(input: EnvInput) {
  return envSchema.safeParse(input);
}
