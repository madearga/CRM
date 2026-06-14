/**
 * Platform-agnostic CRM constants. No environment, framework, or runtime
 * imports — safe to use in `apps/web` and `apps/mobile`.
 */

export const APP_NAME = 'CRM';

export const DEFAULT_PORT = 3000;
export const DEFAULT_SITE_URL = 'http://localhost:3005';
export const DEFAULT_CONVEX_SITE_URL = 'http://localhost:3005';

/**
 * Local storage keys used by Better Auth's `crossDomainClient` plugin. Mobile
 * should map these onto `expo-secure-store`; web typically uses the default
 * `localStorage` implementation. Override the prefix per environment when
 * multiple auth contexts coexist.
 */
export const AUTH_STORAGE_KEYS = {
  COOKIE: 'better-auth_cookie',
  SESSION_DATA: 'better-auth_session_data',
} as const;

export const DEFAULT_AUTH_STORAGE_PREFIX = 'better-auth';

/**
 * Standard auth flow routes. Each platform maps these onto its own
 * navigation / routing scheme.
 */
export const AUTH_ROUTES = {
  SIGN_IN: '/sign-in',
  SIGN_UP: '/sign-up',
  SIGN_OUT: '/sign-out',
  CALLBACK: '/api/auth/callback',
} as const;

/**
 * Convex JWT cookie name. Mirrors the server-side cookie name exported by
 * `@convex-dev/better-auth` so web / mobile clients can reason about the
 * same value when sharing infrastructure knowledge.
 */
export const CONVEX_JWT_COOKIE_NAME = 'convex_jwt';

/**
 * Default auth token lifetime (15 minutes) used by the Convex Better Auth
 * server plugin. Mobile clients should treat tokens as short-lived and
 * re-fetch via `client.convex.token()` before expiry.
 */
export const CONVEX_TOKEN_TTL_SECONDS = 60 * 15;
