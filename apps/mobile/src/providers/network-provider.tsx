/**
 * Global network state provider for the mobile app.
 *
 * Uses a lightweight, dependency-free probe (see `@/lib/network`) instead of
 * `@react-native-community/netinfo` or `expo-network` so the MVP avoids another
 * native-module rebuild. The provider probes the Convex deployment URL on:
 *   - mount
 *   - app returns to the foreground
 *   - a periodic timer while the app is active
 *   - manual `checkNow()` call
 *
 * Consumers read `useNetwork()` and render the global banner only when offline.
 * The hook also exposes `wasRecentlyOffline` so a brief "Back online" success
 * flash can be shown after connectivity is restored.
 *
 * Why probe the Convex URL instead of a generic endpoint? The CRM mobile app
 * is online-only in Phase 1; if the user cannot reach Convex, the app cannot
 * function, regardless of generic internet access.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { mobileEnv } from '@/lib/config';
import {
  DEFAULT_POLL_INTERVAL_MS,
  nextNetworkState,
  probeNetwork,
  shouldMarkOffline,
  type NetworkState,
} from '@/lib/network';

export interface NetworkContextValue {
  /** Current best-guess connectivity state. */
  isOnline: boolean;
  /** True while an async probe is in flight. */
  isChecking: boolean;
  /** True for a short window after the device recovers from offline. */
  wasRecentlyOffline: boolean;
  /** ISO timestamp of the last completed probe, or null before the first. */
  lastCheckedAt: string | null;
  /** Trigger an immediate probe. */
  checkNow: () => void;
}

const NetworkContext = createContext<NetworkContextValue>({
  isOnline: true,
  isChecking: false,
  wasRecentlyOffline: false,
  lastCheckedAt: null,
  checkNow: () => {},
});

/** Duration the "Back online" success flash remains visible. */
const RESTORED_FLASH_MS = 2500;

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<NetworkState>('checking');
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [wasRecentlyOffline, setWasRecentlyOffline] = useState(false);
  const consecutiveFailuresRef = useRef(0);
  const restoredTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const probingRef = useRef(false);
  const mountedRef = useRef(true);

  const probeUrl = useMemo(() => mobileEnv().CONVEX_URL, []);

  const checkNow = useCallback(() => {
    if (!mountedRef.current) return;
    // Guard against overlapping probes: a probe may still be in flight when a
    // foreground event, a poll tick, or a manual `checkNow()` fires. Skip in
    // that case rather than stacking concurrent fetches that would race to
    // update state and skew the consecutive-failure counter.
    if (probingRef.current) return;
    probingRef.current = true;

    setIsChecking(true);
    probeNetwork(probeUrl, DEFAULT_POLL_INTERVAL_MS / 6)
      .then((result) => {
        if (!mountedRef.current) return;

        const next = nextNetworkState(result, state);
        const isNowOnline = next === 'online';

        if (isNowOnline) {
          consecutiveFailuresRef.current = 0;
          if (state === 'offline') {
            // Show the restored flash, replacing any pending hide timer.
            if (restoredTimerRef.current) {
              clearTimeout(restoredTimerRef.current);
            }
            setWasRecentlyOffline(true);
            restoredTimerRef.current = setTimeout(() => {
              if (mountedRef.current) setWasRecentlyOffline(false);
            }, RESTORED_FLASH_MS);
          }
        } else {
          consecutiveFailuresRef.current += 1;
        }

        const shouldBeOffline =
          next !== 'online' && shouldMarkOffline(consecutiveFailuresRef.current);

        setState(shouldBeOffline ? 'offline' : isNowOnline ? 'online' : 'checking');
        setLastCheckedAt(new Date().toISOString());
      })
      .catch(() => {
        if (!mountedRef.current) return;
        consecutiveFailuresRef.current += 1;
        if (shouldMarkOffline(consecutiveFailuresRef.current)) {
          setState('offline');
        }
      })
      .finally(() => {
        probingRef.current = false;
        if (mountedRef.current) setIsChecking(false);
      });
  }, [probeUrl, state]);

  // Initial probe and polling while active.
  useEffect(() => {
    mountedRef.current = true;
    checkNow();

    const pollTimer = setInterval(() => {
      if (AppState.currentState === 'active') {
        checkNow();
      }
    }, DEFAULT_POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(pollTimer);
      if (restoredTimerRef.current) clearTimeout(restoredTimerRef.current);
    };
  }, [checkNow]);

  // Re-probe immediately when returning from background.
  useEffect(() => {
    const handleAppStateChange = (next: AppStateStatus) => {
      if (next === 'active') {
        checkNow();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [checkNow]);

  const value = useMemo<NetworkContextValue>(
    () => ({
      isOnline: state === 'online',
      isChecking,
      wasRecentlyOffline,
      lastCheckedAt,
      checkNow,
    }),
    [state, isChecking, wasRecentlyOffline, lastCheckedAt, checkNow],
  );

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

/** Access global network state. */
export function useNetwork(): NetworkContextValue {
  return useContext(NetworkContext);
}
