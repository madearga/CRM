/**
 * Lightweight date formatting using native Intl API.
 * Replaces date-fns format() and formatDistanceToNow().
 */

const LOCALE = 'id-ID';

const relativeTimeFormatter = new Intl.RelativeTimeFormat(LOCALE, {
  numeric: 'auto',
  style: 'long',
});

const DIVISIONS: { amount: number; name: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, name: 'seconds' },
  { amount: 60, name: 'minutes' },
  { amount: 24, name: 'hours' },
  { amount: 7, name: 'days' },
  { amount: 4.34524, name: 'weeks' },
  { amount: 12, name: 'months' },
  { amount: Number.POSITIVE_INFINITY, name: 'years' },
];

/** Format a date relative to now, e.g. "3 hours ago", "in 2 days".
 *  The `addSuffix` option is accepted for date-fns API compatibility but is a no-op
 *  — suffix is always included (built into Intl.RelativeTimeFormat with numeric: 'auto').
 */
export function formatDistanceToNow(date: Date | number, _opts?: { addSuffix?: boolean }): string {
  const timestamp = typeof date === 'number' ? date : date.getTime();
  const now = Date.now();
  let diff = (timestamp - now) / 1000;

  for (const division of DIVISIONS) {
    if (Math.abs(diff) < division.amount) {
      return relativeTimeFormatter.format(Math.round(diff), division.name);
    }
    diff /= division.amount;
  }
  return relativeTimeFormatter.format(Math.round(diff), 'years');
}

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

/** Format a date with a pattern.
 *  Supported patterns (subset of date-fns):
 *    'MMM d, yyyy' → "Jan 15, 2026"
 *    'MMMM d, yyyy' → "January 15, 2026"
 *    'MM/dd/yyyy'   → "01/15/2026"
 *    'yyyy-MM-dd'   → "2026-01-15"
 *  Time tokens and timezone are NOT supported — use date-fns for those if needed.
 */
export function format(date: Date | number, pattern: string): string {
  const d = typeof date === 'number' ? new Date(date) : date;

  if (!dateFormatters.has(pattern)) {
    const options = patternToOptions(pattern);
    dateFormatters.set(pattern, new Intl.DateTimeFormat(LOCALE, options));
  }

  return dateFormatters.get(pattern)!.format(d);
}

function patternToOptions(pattern: string): Intl.DateTimeFormatOptions {
  const opts: Intl.DateTimeFormatOptions = {};

  if (pattern.includes('MMM') || pattern.includes('MMMM')) {
    opts.month = pattern.includes('MMMM') ? 'long' : 'short';
  } else if (pattern.includes('MM')) {
    opts.month = '2-digit';
  } else if (pattern.includes('M')) {
    opts.month = 'numeric';
  }

  if (pattern.includes('yyyy') || pattern.includes('YYYY')) {
    opts.year = 'numeric';
  } else if (pattern.includes('yy')) {
    opts.year = '2-digit';
  }

  if (pattern.includes('dd') || pattern.includes('DD')) {
    opts.day = '2-digit';
  } else if (pattern.includes('d') && !pattern.includes('do')) {
    opts.day = 'numeric';
  }

  return opts;
}