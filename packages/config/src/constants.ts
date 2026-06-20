/**
 * Platform-agnostic CRM constants. No environment, framework, or runtime
 * imports — safe to use in `apps/web` and `apps/mobile`.
 *
 * ponytail: only the two constants with live consumers are kept. Re-add
 * APP_NAME / AUTH_ROUTES / CONVEX_* / DEFAULT_* when a caller appears.
 */

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