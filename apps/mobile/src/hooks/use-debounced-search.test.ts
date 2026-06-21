/**
 * Unit tests for {@link createDebouncer}, the pure debounce machine backing
 * {@link useDebouncedSearch}.
 *
 * Why test the machine, not the hook? The hook is a thin React bind around
 * this machine (it injects a re-render-aware timer backend). The debounce
 * *behavior* lives entirely here and is pure — no React, no DOM, no dual-React
 * resolver fights. We assert the three contract scenarios the hook guarantees
 * to its callers: initial equality, delayed propagation, and rapid-change
 * coalescing. Fake timers make it deterministic.
 *
 * ponytail: test the logic, not the React plumbing.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { createDebouncer } from './use-debounced-search';

describe('createDebouncer (useDebouncedSearch logic)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initially has input and debounced both equal to the initial value', () => {
    const d = createDebouncer('', 250);
    expect(d.input).toBe('');
    expect(d.debounced).toBe('');
  });

  it('does not update debounced immediately; only after delayMs elapses', () => {
    const d = createDebouncer('', 250);

    d.set('acme');

    // input reflects immediately, debounced does not
    expect(d.input).toBe('acme');
    expect(d.debounced).toBe('');

    // just before the delay — still old
    vi.advanceTimersByTime(249);
    expect(d.debounced).toBe('');

    // past the delay — now propagated
    vi.advanceTimersByTime(1);
    expect(d.debounced).toBe('acme');
  });

  it('coalesces rapid changes so only the final value appears', () => {
    const d = createDebouncer('', 250);

    d.set('a');
    vi.advanceTimersByTime(100); // 100ms in — still pending
    d.set('ab');
    vi.advanceTimersByTime(100); // 200ms in — still pending
    d.set('abc');

    expect(d.debounced).toBe('');
    expect(d.input).toBe('abc');

    // pass the remaining debounce window from the last set
    vi.advanceTimersByTime(250);
    expect(d.debounced).toBe('abc');
  });
});
