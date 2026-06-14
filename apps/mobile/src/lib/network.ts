/**
 * Lightweight, dependency-free network reachability probe for React Native.
 *
 * Avoids `@react-native-community/netinfo` / `expo-network` so the mobile app
 * does not need another native module rebuild. We probe the Convex deployment
 * URL (already a required env var) with a short timeout. A successful HTTP
 * round-trip means the device can reach the backend; a thrown fetch means we
 * are offline / on a captive portal.
 *
 * All functions in this module are pure / side-effect-free and run in plain
 * Node, so they are unit-testable without a React Native environment.
 */

/** Result of a single probe attempt. */
export interface ProbeResult {
  ok: boolean;
  /** Milliseconds elapsed for the round-trip, or `undefined` if it failed. */
  durationMs?: number;
}

const DEFAULT_PROBE_TIMEOUT_MS = 5000;
const DEFAULT_PROBE_METHOD = 'HEAD';

/**
 * Probe whether the device can reach `url`.
 *
 * Uses `AbortController` + a timer so this works in Hermes where
 * `AbortSignal.timeout` may not be available. A non-2xx response still counts
 * as "online" because the request reached a server; only a thrown request
 * counts as offline.
 */
export async function probeNetwork(
  url: string,
  timeoutMs: number = DEFAULT_PROBE_TIMEOUT_MS,
  method: string = DEFAULT_PROBE_METHOD,
): Promise<ProbeResult> {
  const controller = new AbortController();
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => reject(new Error('probe-timeout')), timeoutMs);
    controller.signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new Error('probe-aborted'));
    });
  });
  const start = performance.now();

  try {
    await Promise.race([
      fetch(url, {
        method,
        signal: controller.signal,
        cache: 'no-store',
        headers: { 'x-crm-probe': 'network-check' },
      }),
      timeoutPromise,
    ]);
    return { ok: true, durationMs: Math.round(performance.now() - start) };
  } catch {
    return { ok: false };
  } finally {
    controller.abort();
  }
}

/** Coarse online/offline state. */
export type NetworkState = 'online' | 'offline' | 'checking';

/** Number of consecutive offline probes before we confidently say "offline". */
export const OFFLINE_THRESHOLD = 2;

/** Default poll interval while the app is active. */
export const DEFAULT_POLL_INTERVAL_MS = 30000;

/**
 * Compute the next network state from a probe result and the previous state.
 *
 * Hysteresis: if the previous probe said offline, we require one successful
 * probe to switch back to online. This avoids banner flicker on flaky networks.
 */
export function nextNetworkState(
  result: ProbeResult,
  previous: NetworkState,
): NetworkState {
  if (result.ok) return 'online';
  // If we were already offline, stay offline. If we were checking/online, one
  // failure is not enough; the caller increments a counter and only marks
  // offline after the threshold.
  return previous === 'offline' ? 'offline' : 'checking';
}

/**
 * Determine whether a failed probe should flip the global flag to offline.
 */
export function shouldMarkOffline(consecutiveFailures: number): boolean {
  return consecutiveFailures >= OFFLINE_THRESHOLD;
}
