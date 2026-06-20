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
import { AUTH_STORAGE_KEYS } from '@crm/config';

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
 * The two keys Better Auth persists.
 * `crossDomainClient` writes the session cookie and session data here on
 * successful auth; reading them back on a cold start rehydrates the session
 * without a re-login.
 *
 * `AUTH_STORAGE_KEYS` already includes the `better-auth` prefix, so we use them
 * verbatim rather than double-prefixing.
 */
const SECURE_KEYS = {
  COOKIE: AUTH_STORAGE_KEYS.COOKIE,
  SESSION_DATA: AUTH_STORAGE_KEYS.SESSION_DATA,
} as const;

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
 * Result of scrubbing secure storage. `failedKeys` lists any key that could
 * be neither deleted nor overwritten with an empty string — i.e. a key whose
 * previous value may still be present. When `failedKeys` is empty, callers
 * can trust that no usable Better Auth token remains on device.
 */
export interface ClearSecureStorageResult {
  /** `true` when every key was scrubbed (deleted or blanked). */
  cleared: boolean;
  /** Keys that resisted both deletion and the empty-string fallback. */
  failedKeys: string[];
}

/**
 * Wipe all Better Auth entries from the keystore. Called on explicit sign-out
 * (and on token revocation) so a restart does not silently restore the
 * previous session.
 *
 * Returns a {@link ClearSecureStorageResult} so the caller (e.g.
 * `AuthProvider.signOut`) can decide whether to complete the machine.
 *
 * Failure handling: `expo-secure-store` only exposes an asynchronous delete
 * API (`deleteItemAsync`). If deletion rejects (locked keystore, keychain quirk)
 * we fall back to overwriting the value with an empty string, which neutralises
 * the value even when the keychain refuses to drop the key. Only if BOTH
 * delete and overwrite fail is the key reported in `failedKeys`.
 */
export async function clearSecureAuthStorage(): Promise<ClearSecureStorageResult> {
  const failedKeys: string[] = [];
  for (const key of Object.values(SECURE_KEYS)) {
    let scrubbed = false;
    try {
      await SecureStore.deleteItemAsync(key, SECURE_OPTIONS);
      scrubbed = true;
    } catch {
      // Delete failed (e.g. locked keystore). Defensive fallback: overwrite
      // the value with an empty string so no usable token survives, even if
      // the key itself can't be removed.
      try {
        SecureStore.setItem(key, '', SECURE_OPTIONS);
        scrubbed = true;
      } catch {
        /* both paths failed — record and continue */
      }
    }
    if (!scrubbed) failedKeys.push(key);
  }
  return { cleared: failedKeys.length === 0, failedKeys };
}

export { KEYCHAIN_ACCESSIBLE, SECURE_KEYS };
