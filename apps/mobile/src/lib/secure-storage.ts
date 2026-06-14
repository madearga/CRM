/**
 * Secure, persistent storage adapter for Better Auth's `crossDomainClient`.
 *
 * `expo-secure-store` backs onto the iOS Keychain and the Android Keystore —
 * values survive app restarts and are encrypted at rest. This is the mobile
 * equivalent of the web app's `localStorage`.
 *
 * `crossDomainClient` reads synchronously (`getItem` returns `string | null`),
 * but `expo-secure-store`'s API is async. We bridge that with the synchronous
 * `getItem` / `setItem` *Sync* variants, which are available and recommended
 * for exactly this kind of adapter. If a value is absent or the keystore is
 * locked, `getItem` returns `null`, which Better Auth treats as "no session".
 */
import * as SecureStore from 'expo-secure-store';

import type { CrmAuthStorage } from '@crm/auth';
import { AUTH_STORAGE_KEYS, DEFAULT_AUTH_STORAGE_PREFIX } from '@crm/config';

/**
 * The two keys Better Auth persists under the configured prefix.
 * `crossDomainClient` writes the session cookie and session data here on
 * successful auth; reading them back on a cold start rehydrates the session
 * without a re-login.
 */
const SECURE_KEYS = {
  COOKIE: `${DEFAULT_AUTH_STORAGE_PREFIX}_cookie`,
  SESSION_DATA: `${DEFAULT_AUTH_STORAGE_PREFIX}_session_data`,
} satisfies typeof AUTH_STORAGE_KEYS;

export const secureAuthStorage: CrmAuthStorage = {
  getItem: (key) => {
    try {
      return SecureStore.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      void SecureStore.setItem(key, value);
    } catch {
      /* no-op: a locked keystore is non-fatal for a spike */
    }
  },
};

/**
 * Wipe all Better Auth entries from the keystore. Call on explicit sign-out
 * so a restart does not silently restore the previous session.
 */
export function clearSecureAuthStorage(): void {
  for (const key of Object.values(SECURE_KEYS)) {
    try {
      SecureStore.deleteItem(key);
    } catch {
      /* ignore */
    }
  }
}

export { SECURE_KEYS };
