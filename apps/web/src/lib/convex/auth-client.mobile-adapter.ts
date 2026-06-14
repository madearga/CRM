/**
 * Thin web adapter that bridges the platform-agnostic {@link createCrmAuthClient}
 * (from `@crm/auth`) with browser/React concerns.
 *
 * This file is intentionally OPTIONAL. The existing `auth-client.ts` in this
 * directory continues to be the source of truth for the running web app. It is
 * left untouched per the U2 plan ("leave untouched unless type alignment
 * absolutely requires it"). This adapter exists so the web app can opt into
 * the shared client without duplicating plugin wiring, and so future web work
 * can migrate off the bespoke client incrementally.
 *
 * What makes this a *web* adapter (vs. the shared factory):
 *  - Uses `localStorage` for cross-domain session persistence.
 *  - Layers the fully-configured `organizationClient({ ac, roles })` plugin on
 *    top, because `ac`/`roles` live in the Convex server module
 *    (`@convex/authPermissions`) and must NOT be imported by
 *    `@crm/auth` (platform-agnostic).
 *  - Pulls `baseURL` from the web env.
 */
import { organizationClient } from 'better-auth/client/plugins';
import { ac, roles } from '@convex/authPermissions';

import { createCrmAuthClient, type CrmAuthClient } from '@crm/auth';

/**
 * Build a web-specific Better Auth client from the shared factory.
 *
 * `baseURL` is injected by the caller (web env) so this module never reads
 * `process.env` at import time and stays safe to import during SSR.
 */
export function createWebAuthClient(baseURL: string): CrmAuthClient {
  return createCrmAuthClient({
    baseURL,
    storage:
      typeof window !== 'undefined' ? window.localStorage : undefined,
    plugins: [organizationClient({ ac, roles })],
  });
}
