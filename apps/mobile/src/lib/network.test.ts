/**
 * Unit tests for the dependency-free network probe helpers.
 *
 * These run in plain Node (no React Native runtime) because the helpers are
 * pure functions plus a thin `fetch` wrapper that we mock.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_POLL_INTERVAL_MS,
  nextNetworkState,
  OFFLINE_THRESHOLD,
  probeNetwork,
  shouldMarkOffline,
  type ProbeResult,
} from './network';

const convexUrl = 'https://happy-anvil-123.convex.cloud';

describe('probeNetwork', () => {
  it('returns ok:true when fetch resolves quickly', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

    const result = await probeNetwork(convexUrl);

    expect(result.ok).toBe(true);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(fetch).toHaveBeenCalledWith(
      convexUrl,
      expect.objectContaining({ method: 'HEAD', cache: 'no-store' }),
    );
  });

  it('returns ok:true for a non-2xx server response (reachability counts)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 502 }));

    const result = await probeNetwork(convexUrl);

    expect(result.ok).toBe(true);
  });

  it('returns ok:false when fetch throws', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Network request failed'));

    const result = await probeNetwork(convexUrl);

    expect(result.ok).toBe(false);
    expect(result.durationMs).toBeUndefined();
  });

  it('aborts the request after the timeout', async () => {
    globalThis.fetch = vi.fn(
      () => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 60_000)),
    );

    const result = await probeNetwork(convexUrl, 10);

    expect(result.ok).toBe(false);
    const callArgs = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(callArgs.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('nextNetworkState', () => {
  it('switches any prior state to online on success', () => {
    const success: ProbeResult = { ok: true, durationMs: 120 };
    expect(nextNetworkState(success, 'offline')).toBe('online');
    expect(nextNetworkState(success, 'checking')).toBe('online');
    expect(nextNetworkState(success, 'online')).toBe('online');
  });

  it('stays offline once offline on failure', () => {
    const failure: ProbeResult = { ok: false };
    expect(nextNetworkState(failure, 'offline')).toBe('offline');
  });

  it('enters checking on a single failure from online', () => {
    const failure: ProbeResult = { ok: false };
    expect(nextNetworkState(failure, 'online')).toBe('checking');
  });
});

describe('shouldMarkOffline', () => {
  it('requires the threshold of consecutive failures to mark offline', () => {
    expect(shouldMarkOffline(0)).toBe(false);
    expect(shouldMarkOffline(1)).toBe(false);
    expect(shouldMarkOffline(OFFLINE_THRESHOLD)).toBe(true);
    expect(shouldMarkOffline(OFFLINE_THRESHOLD + 3)).toBe(true);
  });
});

describe('constants', () => {
  it('keeps a reasonable poll interval', () => {
    expect(DEFAULT_POLL_INTERVAL_MS).toBeGreaterThanOrEqual(15_000);
  });

  it('keeps a small offline threshold to avoid false positives', () => {
    expect(OFFLINE_THRESHOLD).toBeGreaterThanOrEqual(1);
    expect(OFFLINE_THRESHOLD).toBeLessThanOrEqual(5);
  });
});
