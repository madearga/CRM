import {
  inferAdditionalFields,
  organizationClient,
} from 'better-auth/client/plugins';
import type { BetterAuthClientPlugin } from 'better-auth/client';
import {
  convexClient,
  crossDomainClient,
} from '@convex-dev/better-auth/client/plugins';

import { DEFAULT_AUTH_STORAGE_PREFIX } from '@crm/config';

/**
 * Synchronous key/value storage contract required by Better Auth's
 * `crossDomainClient` plugin. `expo-secure-store`'s synchronous
 * `getItem`/`setItem` satisfy this; web uses `localStorage`.
 *
 * Methods are intentionally synchronous because the cross-domain plugin reads
 * cookies inline during fetch interception. Async stores must be adapted to a
 * sync shim by the host platform.
 */
export interface CrmAuthStorage {
  setItem: (key: string, value: string) => void;
  getItem: (key: string) => string | null;
}

export interface CrmAuthClientPluginsOptions {
  /**
   * Optional platform storage. When provided, the `crossDomainClient` plugin
   * is enabled so session cookies survive across the web↔mobile/API boundary.
   * Omit on platforms that rely on cookie-based sessions only (SSR web).
   */
  storage?: CrmAuthStorage;
  /**
   * Extra Better Auth client plugins (e.g. a fully-configured
   * `organizationClient({ ac, roles })` from the web app). Appended after the
   * shared defaults.
   */
  plugins?: BetterAuthClientPlugin[];
}

/**
 * Build the canonical CRM Better Auth client plugin list.
 *
 * This is the **single source of truth** for which plugins every CRM client
 * (web, mobile, server-side) must enable, so the React Native client cannot
 * silently drift out of sync with the web/server client. Both
 * `better-auth/client`'s `createAuthClient` and `better-auth/react`'s
 * `createAuthClient` accept the resulting `BetterAuthClientPlugin[]`.
 *
 * Plugins always included:
 *  - `inferAdditionalFields()` — keeps client typing in sync with the server
 *    without importing the server `auth` instance.
 *  - `organizationClient()` — enables organization endpoints. Web may pass a
 *    fully-configured instance via `options.plugins` if it needs role/AC.
 *  - `convexClient()` — exposes `client.convex.token()` for the Convex token
 *    exchange required by `ConvexReactClient.setAuth`.
 *
 * Plugins included only when `storage` is provided:
 *  - `crossDomainClient({ storage, storagePrefix })` — persists session
 *    cookies in platform storage so mobile (or any non-browser client) can
 *    authenticate against the same backend.
 */
export function crmAuthClientPlugins(
  options: CrmAuthClientPluginsOptions = {},
): BetterAuthClientPlugin[] {
  const { storage, plugins: extraPlugins = [] } = options;

  const plugins: BetterAuthClientPlugin[] = [
    inferAdditionalFields(),
    organizationClient(),
    convexClient(),
  ];

  if (storage) {
    plugins.push(
      crossDomainClient({
        storage,
        storagePrefix: DEFAULT_AUTH_STORAGE_PREFIX,
      }),
    );
  }

  plugins.push(...extraPlugins);
  return plugins;
}