import { z } from 'zod';

/**
 * Platform-agnostic environment schemas.
 *
 * Validated with plain Zod (no Next.js / Vite / runtime-specific deps) so
 * both `apps/web` and `apps/mobile` can import it. The host application is
 * responsible for providing an `input` record (e.g. `process.env` on web /
 * server, or Expo `Constants.expoConfig.extra` on mobile) — this module
 * never reads environment variables at import time.
 *
 * ## Client vs server schema split
 *
 * Two schemas are exposed to prevent server-only secrets from leaking into
 * client bundles:
 *
 *  - {@link clientEnvSchema} — safe to embed in ANY bundle (web browser, RN).
 *    Contains only public values (Convex URL, site URL, public OAuth client
 *    IDs). Crucially does **not** include `BETTER_AUTH_SECRET`.
 *  - {@link envSchema} — the full schema used by server / privileged runtimes.
 *    Extends the client schema with `BETTER_AUTH_SECRET`, which Convex
 *    validates server-side and must never reach a client bundle.
 *
 * Mobile (`apps/mobile`) MUST validate against {@link clientEnvSchema} via
 * {@link parseClientEnv}. A previous version mapped an `EXPO_PUBLIC_*` stub
 * into `BETTER_AUTH_SECRET` to satisfy the full schema — that was both
 * fragile (any `EXPO_PUBLIC_BETTER_AUTH_SECRET*` var would inline the real
 * secret into the RN bundle) and unnecessary, since the mobile client never
 * uses the secret. The split removes that footgun entirely.
 *
 * The web app's `@t3-oss/env-nextjs`-based `env.ts` continues to own
 * `NEXT_PUBLIC_*` / `NODE_ENV` split, but can re-export or align with these
 * schemas to keep a single source of truth.
 */

/**
 * Client-safe schema. Every field here is safe to inline into a browser or
 * React Native bundle. Server-only secrets MUST NOT be added here.
 */
export const clientEnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('production'),

  // Convex deployment (the public URL is safe to embed in any client bundle).
  // Must be HTTPS in production; localhost allowed for development.
  CONVEX_URL: z
    .string()
    .min(1, 'CONVEX_URL is required')
    .refine(
      (url) =>
        url.startsWith('https://') ||
        url.startsWith('http://localhost') ||
        url.startsWith('http://127.0.0.1'),
      {
        message: 'CONVEX_URL must use https:// in production or localhost for development',
      },
    ),

  // Convex site URL. Must be HTTPS in production; localhost allowed for development.
  CONVEX_SITE_URL: z
    .string()
    .min(1, 'CONVEX_SITE_URL is required')
    .refine(
      (url) =>
        url.startsWith('https://') ||
        url.startsWith('http://localhost') ||
        url.startsWith('http://127.0.0.1'),
      {
        message: 'CONVEX_SITE_URL must use https:// in production or localhost for development',
      },
    )
    .default('http://localhost:3005'),

  // Public site origin. Used for OAuth redirects, deep links, etc.
  // Must be HTTPS in production; localhost allowed for development.
  SITE_URL: z
    .string()
    .min(1)
    .refine(
      (url) =>
        url.startsWith('https://') ||
        url.startsWith('http://localhost') ||
        url.startsWith('http://127.0.0.1'),
      {
        message: 'SITE_URL must use https:// in production or localhost for development',
      },
    )
    .optional()
    .default('http://localhost:3005'),

  // OAuth provider public client IDs (safe to expose to the client).
  GOOGLE_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
});

/**
 * Full / server schema. Extends the client schema with server-only secrets.
 * Use this ONLY in privileged runtimes (Convex backend, server actions) where
 * the validated values never reach a client bundle.
 */
export const envSchema = clientEnvSchema.extend({
  // Server-side / shared secret. The Convex backend validates this; on web it
  // lives in `process.env` (server only) and must never reach the client
  // bundle. Mobile never reads it directly — it is exchanged through
  // Better Auth's server endpoints.
  BETTER_AUTH_SECRET: z.string().min(1, 'BETTER_AUTH_SECRET is required'),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type Env = z.infer<typeof envSchema>;

/**
 * Shape of the input record passed to {@link parseEnv} / {@link parseClientEnv}.
 * Mirrors `process.env`: every value is either a string or `undefined`.
 */
export type EnvInput = Record<string, string | undefined>;

function formatErrors(input: z.ZodError): string {
  const errors = input.flatten().fieldErrors;
  const formatted = Object.entries(errors)
    .map(([key, msgs]) => `  - ${key}: ${(msgs ?? []).join(', ')}`)
    .join('\n');
  return formatted || '  (unknown validation error)';
}

/**
 * Parse and validate a client-safe environment-variable record. Throws with a
 * clear, human-readable error message listing each invalid field on failure.
 *
 * Use this in client bundles (web browser, React Native). It intentionally
 * does not accept `BETTER_AUTH_SECRET` so a server secret can never be
 * accidentally inlined into a client bundle via an `EXPO_PUBLIC_*` / public
 * env var.
 */
export function parseClientEnv(input: EnvInput): ClientEnv {
  const result = clientEnvSchema.safeParse(input);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${formatErrors(result.error)}`);
  }
  return result.data;
}

/**
 * Non-throwing variant of {@link parseClientEnv}.
 */
export function safeParseClientEnv(input: EnvInput) {
  return clientEnvSchema.safeParse(input);
}

/**
 * Parse and validate a full (server) environment-variable record. Throws with
 * a clear, human-readable error message listing each invalid field on
 * failure — this is the "missing required env var throws clear error at
 * startup" guarantee the platform-agnostic packages are required to provide.
 *
 * Use this ONLY in privileged runtimes; never in a client bundle.
 */
export function parseEnv(input: EnvInput): Env {
  const result = envSchema.safeParse(input);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${formatErrors(result.error)}`);
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
