/**
 * Secure, persistent storage adapter for Better Auth's `crossDomainClient`.
 *
 * `expo-secure-store` backs onto the iOS Keychain and the Android Keystore —
 * values survive app restarts and are encrypted at rest. This is the mobile
 * equivalent of the web app's `localStorage`.
 *
 * `crossDomainClient` reads synchronously (`getItem` returns `string | null`),
 * but `expo-secure-store`'s async API can't satisfy that contract. We bridge
 * with the synchronous `getItem`/`setItem` variants, which are available and
 * documented for exactly this adapter use-case. If a value is absent or the
 * keystore is locked, `getItem` returns `null`, which Better Auth treats as
 * "no session".
 *
 * Security posture (U3 requirement):
 *  - `keychainAccessible = WHEN_UNLOCKED_THIS_DEVICE_ONLY`. The entry is only
 *    readable while the device is unlocked, and is NEVER migrated to a new
 *    device on backup restore — so a stolen/restore-to-new-device attempt
 *    cannot surface the CRM session.
 *  - No plaintext PII is stored: only the Better Auth session cookie + the
 *    session-data blob written by `crossDomainClient` under the configured
 *    prefix.
 */
import * as SecureStore from 'expo-secure-store';

import type { CrmAuthStorage } from '@crm/auth';
import { AUTH_STORAGE_KEYS, DEFAULT_AUTH_STORAGE_PREFIX } from '@crm/config';

/**
 * iOS keychain accessibility flag passed on every read/write/delete. Kept as a
 * shared constant so all operations stay consistent — a mismatch between write
 * and read accessibility can make the key invisible across launches.
 */
const KEYCHAIN_ACCESSIBLE = SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY;

/**
 * Storage options forwarded to every `expo-secure-store` call. Centralising
 * them guarantees the `whenUnlockedThisDeviceOnly` posture is never silently
 * relaxed by a stray call site.
 */
const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: KEYCHAIN_ACCESSIBLE,
};

/**
 * The two keys Better Auth persists under the configured prefix.
 * `crossDomainClient` writes the session cookie and session data here on
 * successful auth; reading them back on a cold start rehydrates the session
 * without a re-login.
 */
const SECURE_KEYS = {
  COOKIE: `${DEFAULT_AUTH_STORAGE_PREFIX}_${AUTH_STORAGE_KEYS.COOKIE}`,
  SESSION_DATA: `${DEFAULT_AUTH_STORAGE_PREFIX}_${AUTH_STORAGE_KEYS.SESSION_DATA}`,
} satisfies typeof AUTH_STORAGE_KEYS;

/**
 * Synchronous key/value adapter handed to `crossDomainClient({ storage })`.
 * Failures (locked keystore, keychain unavailable) degrade to `null`/no-op so
 * Better Auth simply treats the state as "no session" rather than crashing.
 */
export const secureAuthStorage: CrmAuthStorage = {
  getItem: (key) => {
    try {
      return SecureStore.getItem(key, SECURE_OPTIONS);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      SecureStore.setItem(key, value, SECURE_OPTIONS);
    } catch {
      /* no-op: a locked keystore is non-fatal; next launch retries */
    }
  },
};

/**
 * Wipe all Better Auth entries from the keystore. Called on explicit sign-out
 * (and on token revocation) so a restart does not silently restore the
 * previous session.
 */
export function clearSecureAuthStorage(): void {
  for (const key of Object.values(SECURE_KEYS)) {
    try {
      SecureStore.deleteItem(key, SECURE_OPTIONS);
    } catch {
      /* ignore — best-effort scrub */
    }
  }
}

/** Read a single secure value (e.g. to inspect whether a token exists). */
export function readSecureValue(key: keyof typeof SECURE_KEYS): string | null {
  try {
    return SecureStore.getItem(SECURE_KEYS[key], SECURE_OPTIONS);
  } catch {
    return null;
  }
}

export { KEYCHAIN_ACCESSIBLE, SECURE_KEYS };
