/**
 * Debounced search.
 *
 * Split into a pure {@link createDebouncer} (timer-driven, React-free, trivially
 * unit-testable with fake timers — no DOM, no dual-React fighting) and a thin
 * {@link useDebouncedSearch} React wrapper that injects a re-render-aware timer
 * backend so the hook stays a single source of truth over the debounce logic.
 *
 * `input`/`setInput` are immediate (bound to the TextInput); `debounced` lags
 * by `delayMs` so we don't re-query Convex on every keystroke.
 *
 * ponytail: test the debounce logic, not React plumbing.
 */
import { useEffect, useReducer, useRef } from 'react';

export interface Debouncer {
  /** Immediate value — always reflects the last `set`. */
  input: string;
  /** Lagged value — updates `delayMs` after the last `set`. */
  debounced: string;
  set(value: string): void;
  /** Cancel any pending propagation. Call on teardown. */
  dispose(): void;
}

/** Timer backend — defaults to globals so tests can inject fakes. */
export interface TimerBackend {
  setTimeout: (cb: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
}

/**
 * Build a debouncer. Pure: no React, no DOM. Drives `input`/`debounced` via
 * the supplied (or global) timer backend.
 */
export function createDebouncer(
  initial: string = '',
  delayMs: number = 250,
  backend: TimerBackend = { setTimeout, clearTimeout },
): Debouncer {
  let handle: unknown = null;
  return {
    input: initial,
    debounced: initial,
    set(value: string) {
      this.input = value;
      if (handle !== null) backend.clearTimeout(handle);
      handle = backend.setTimeout(() => {
        this.debounced = value;
      }, delayMs);
    },
    dispose() {
      if (handle !== null) backend.clearTimeout(handle);
      handle = null;
    },
  };
}

/**
 * React-bound debounced search. Wraps {@link createDebouncer} with a timer
 * backend that re-renders whenever the debounce timer fires, so `debounced`
 * stays reactive. One source of truth for the logic; the hook just plumbs.
 */
export function useDebouncedSearch(initial: string = '', delayMs: number = 250) {
  const force = useReducer((n: number) => n + 1, 0)[1];
  const ref = useRef<Debouncer | null>(null);

  if (ref.current === null) {
    // ponytail: re-render-aware timer backend — when the debounce callback
    // fires, force a re-render so consumers read the updated `debounced`.
    ref.current = createDebouncer(initial, delayMs, {
      setTimeout: (cb, ms) =>
        setTimeout(() => {
          cb();
          force();
        }, ms) as unknown as ReturnType<typeof setTimeout>,
      clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    });
  }

  useEffect(() => () => ref.current?.dispose(), []);

  const d = ref.current;
  return {
    input: d.input,
    setInput: (v: string) => {
      d.set(v);
      force();
    },
    debounced: d.debounced,
  };
}
