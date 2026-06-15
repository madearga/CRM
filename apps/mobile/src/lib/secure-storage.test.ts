/**
 * Tests for secure-storage's clearSecureAuthStorage.
 *
 * Guards the P1 fix: deletion failures must not be silently swallowed, and a
 * delete that throws must trigger the empty-string overwrite fallback so no
 * usable token survives. `expo-secure-store` is mocked because it is a native
 * module unavailable in the Node test environment.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the native secure-store module BEFORE importing the module under test.
// `WHEN_UNLOCKED_THIS_DEVICE_ONLY` is read at module-load time; the item
// methods are spied per-test.
const secureStoreMock = {
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 0,
  getItem: vi.fn(),
  setItem: vi.fn(),
  deleteItem: vi.fn(),
};
vi.mock('expo-secure-store', () => ({
  default: secureStoreMock,
  ...secureStoreMock,
}));

// Import after the mock is registered.
const { clearSecureAuthStorage, SECURE_KEYS } = await import('./secure-storage');

const allKeys = Object.values(SECURE_KEYS);

describe('clearSecureAuthStorage', () => {
  beforeEach(() => {
    secureStoreMock.deleteItem.mockReset();
    secureStoreMock.setItem.mockReset();
  });

  it('deletes every key and reports cleared:true with no failures', () => {
    secureStoreMock.deleteItem.mockReturnValue(true);

    const result = clearSecureAuthStorage();

    expect(result.cleared).toBe(true);
    expect(result.failedKeys).toEqual([]);
    expect(secureStoreMock.deleteItem).toHaveBeenCalledTimes(allKeys.length);
    // No fallback overwrite needed when delete succeeds.
    expect(secureStoreMock.setItem).not.toHaveBeenCalled();
  });

  it('falls back to overwriting with an empty string when delete throws', () => {
    secureStoreMock.deleteItem.mockImplementation(() => {
      throw new Error('keychain locked');
    });
    secureStoreMock.setItem.mockReturnValue(undefined);

    const result = clearSecureAuthStorage();

    // Empty-string overwrite neutralises the token, so the key is still
    // considered scrubbed.
    expect(result.cleared).toBe(true);
    expect(result.failedKeys).toEqual([]);
    // Each key: one failed delete + one empty-string overwrite.
    expect(secureStoreMock.setItem).toHaveBeenCalledTimes(allKeys.length);
    for (const call of secureStoreMock.setItem.mock.calls) {
      expect(call[1]).toBe('');
    }
  });

  it('reports failedKeys when BOTH delete and overwrite throw', () => {
    secureStoreMock.deleteItem.mockImplementation(() => {
      throw new Error('delete failed');
    });
    secureStoreMock.setItem.mockImplementation(() => {
      throw new Error('write failed');
    });

    const result = clearSecureAuthStorage();

    expect(result.cleared).toBe(false);
    expect(result.failedKeys).toEqual(expect.arrayContaining(allKeys));
    expect(result.failedKeys).toHaveLength(allKeys.length);
  });
});
