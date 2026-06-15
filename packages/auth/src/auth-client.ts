import type { ClientOptions } from 'better-auth/client';
import { createAuthClient } from 'better-auth/client';
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

export interface CreateCrmAuthClientOptions {
  /**
   * Origin of the Better Auth backend. On web this is the site URL; on mobile
   * it is the Convex site URL (`CONVEX_SITE_URL`). Required.
   */
  baseURL: string;
  /**
   * Optional platform storage. When provided, the `crossDomainClient` plugin
   * is enabled so session cookies survive across the web↔mobile/API boundary.
   * Omit on platforms that rely on cookie-based sessions only (SSR web).
   */
  storage?: CrmAuthStorage;
  /**
   * Storage key prefix for cross-domain session data. Defaults to the shared
   * `DEFAULT_AUTH_STORAGE_PREFIX` constant.
   */
  storagePrefix?: string;
  /**
   * Disable the cross-domain client's in-memory + storage session cache.
   * Useful when a platform wants every `useSession` to hit the network.
   */
  disableCrossDomainCache?: boolean;
  /**
   * Extra Better Auth client plugins (e.g. a fully-configured
   * `organizationClient({ ac, roles })` from the web app, social providers,
   * etc.). These are appended after the shared defaults.
   */
  plugins?: BetterAuthClientPlugin[];
  /**
   * Additional fetch options forwarded to `createAuthClient`.
   */
  fetchOptions?: ClientOptions['fetchOptions'];
}

/**
 * Options for {@link crmAuthClientPlugins}. Mirrors the storage-related subset
 * of {@link CreateCrmAuthClientOptions} so the plugin list can be built once
 * and shared across client flavours (agnostic `better-auth/client` vs React
 * `better-auth/react`).
 */
export interface CrmAuthClientPluginsOptions {
  /**
   * Optional platform storage. When provided, the `crossDomainClient` plugin
   * is enabled so session cookies survive across the web↔mobile/API boundary.
   * Omit on platforms that rely on cookie-based sessions only (SSR web).
   */
  storage?: CrmAuthStorage;
  /**
   * Storage key prefix for cross-domain session data. Defaults to the shared
   * `DEFAULT_AUTH_STORAGE_PREFIX` constant.
   */
  storagePrefix?: string;
  /**
   * Disable the cross-domain client's in-memory + storage session cache.
   * Useful when a platform wants every `useSession` to hit the network.
   */
  disableCrossDomainCache?: boolean;
  /**
   * Extra Better Auth client plugins (e.g. a fully-configured
   * `organizationClient({ ac, roles })` from the web app, social providers,
   * etc.). These are appended after the shared defaults.
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
  const {
    storage,
    storagePrefix = DEFAULT_AUTH_STORAGE_PREFIX,
    disableCrossDomainCache,
    plugins: extraPlugins = [],
  } = options;

  const plugins: BetterAuthClientPlugin[] = [
    inferAdditionalFields(),
    organizationClient(),
    convexClient(),
  ];

  if (storage) {
    plugins.push(
      crossDomainClient({
        storage,
        storagePrefix,
        disableCache: disableCrossDomainCache,
      }),
    );
  }

  plugins.push(...extraPlugins);
  return plugins;
}

/**
 * Create the shared, platform-agnostic Better Auth client used by the CRM.
 *
 * This factory deliberately imports from `better-auth/client` (NOT
 * `better-auth/react`) and from `@convex-dev/better-auth/client/plugins`
 * (NOT `.../react`), so it introduces zero web-only / React-only runtime
 * dependencies. It never imports `next`, `next/headers`, `react-dom/server`,
 * the Convex server `auth` instance, or `@convex/authPermissions` — those
 * remain web/server concerns and can be layered on via `options.plugins`.
 *
 * Plugin selection is delegated to {@link crmAuthClientPlugins} so the
 * agnostic client and the React Native client stay in lockstep.
 */
export function createCrmAuthClient(options: CreateCrmAuthClientOptions) {
  const { baseURL, storage, storagePrefix, disableCrossDomainCache, plugins, fetchOptions } =
    options;

  return createAuthClient({
    baseURL,
    plugins: crmAuthClientPlugins({
      storage,
      storagePrefix,
      disableCrossDomainCache,
      plugins,
    }),
    fetchOptions,
  });
}

/** The fully-typed auth client returned by {@link createCrmAuthClient}. */
export type CrmAuthClient = ReturnType<typeof createCrmAuthClient>;

/** Email/password sign-in action. */
export type SignIn = CrmAuthClient['signIn'];
/** Session sign-out action. */
export type SignOut = CrmAuthClient['signOut'];
/** Email/password sign-up action. */
export type SignUp = CrmAuthClient['signUp'];
/** Reactive session listener (nanostores atom; bridge to React on mobile). */
export type UseSession = CrmAuthClient['useSession'];
