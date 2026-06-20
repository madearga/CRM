/**
 * Regression tests for format-date input guards.
 *
 * Guards the latent crash where `formatDistanceToNow`/`format` would throw on
 * `undefined`/`null` inputs before reaching the NaN→`'—'` fallback. The
 * dashboard already filters non-number inputs, but this is a shared util; a
 * future caller passing a missing field must degrade to `'—'`, not crash.
 */
import { describe, expect, it } from 'vitest';

import { format, formatDateTime, formatDistanceToNow } from './format-date';

describe('formatDistanceToNow', () => {
  it('returns "—" for undefined (does not throw)', () => {
    // ponytail: cast through unknown to exercise the runtime guard the TS types forbid.
    expect(formatDistanceToNow(undefined as unknown as number)).toBe('—');
  });

  it('returns "—" for NaN', () => {
    expect(formatDistanceToNow(NaN)).toBe('—');
  });

  it('returns "—" for null', () => {
    expect(formatDistanceToNow(null as unknown as number)).toBe('—');
  });

  it('returns a non-empty string for a recent numeric timestamp', () => {
    const result = formatDistanceToNow(Date.now());
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toBe('—');
  });
});

describe('format', () => {
  it('returns "—" for undefined (does not throw)', () => {
    expect(format(undefined as unknown as number, 'MMM d, yyyy')).toBe('—');
  });

  it('returns "—" for NaN', () => {
    expect(format(NaN, 'MMM d, yyyy')).toBe('—');
  });

  it('formats a valid Date without throwing and includes the year', () => {
    const result = format(new Date('2026-01-15'), 'MMM d, yyyy');
    expect(typeof result).toBe('string');
    expect(result).toContain('2026');
  });
});

describe('formatDateTime', () => {
  it('returns "—" for undefined (delegates to format)', () => {
    expect(formatDateTime(undefined as unknown as number)).toBe('—');
  });
});
