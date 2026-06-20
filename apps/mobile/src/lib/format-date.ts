/**
 * Lightweight date formatting using native Intl API.
 * Replaces date-fns format() and formatDistanceToNow().
 *
 * Adapted from `apps/web/src/lib/format-date.ts` with React Native/Hermes
 * fallbacks. Hermes in Expo Go does not always provide the full Intl surface
 * (notably `Intl.RelativeTimeFormat`), so avoid constructing Intl formatters at
 * module scope and degrade gracefully when a formatter is missing.
 */
const LOCALE = 'id-ID';

type RelativeUnit = Intl.RelativeTimeFormatUnit;

const relativeTimeFormatter = createRelativeTimeFormatter();

function createRelativeTimeFormatter(): Intl.RelativeTimeFormat | null {
  try {
    if (typeof Intl?.RelativeTimeFormat !== 'function') return null;
    return new Intl.RelativeTimeFormat(LOCALE, {
      numeric: 'auto',
      style: 'long',
    });
  } catch {
    return null;
  }
}

const DIVISIONS: { amount: number; name: RelativeUnit }[] = [
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
export function formatDistanceToNow(
  date: Date | number,
  _opts?: { addSuffix?: boolean }
): string {
  // ponytail: shared util — degrade bad inputs to '—' instead of throwing before the NaN guard.
  if (date === undefined || date === null || (typeof date !== 'number' && !(date instanceof Date))) return '—';
  const timestamp = typeof date === 'number' ? date : date.getTime();
  if (!Number.isFinite(timestamp)) return '—';
  const now = Date.now();
  let diff = (timestamp - now) / 1000;

  for (const division of DIVISIONS) {
    if (Math.abs(diff) < division.amount) {
      return formatRelativeTime(Math.round(diff), division.name);
    }
    diff /= division.amount;
  }
  return formatRelativeTime(Math.round(diff), 'years');
}

function formatRelativeTime(value: number, unit: RelativeUnit): string {
  if (relativeTimeFormatter) {
    return relativeTimeFormatter.format(value, unit);
  }

  // Hermes fallback. Keep wording simple and Indonesian-friendly rather than
  // pulling a large Intl polyfill into the mobile bundle.
  if (value === 0) return 'baru saja';

  const amount = Math.abs(value);
  const unitLabel = relativeUnitLabels[unit] ?? unit;
  return value < 0 ? `${amount} ${unitLabel} lalu` : `dalam ${amount} ${unitLabel}`;
}

const relativeUnitLabels: Partial<Record<RelativeUnit, string>> = {
  seconds: 'detik',
  second: 'detik',
  minutes: 'menit',
  minute: 'menit',
  hours: 'jam',
  hour: 'jam',
  days: 'hari',
  day: 'hari',
  weeks: 'minggu',
  week: 'minggu',
  months: 'bulan',
  month: 'bulan',
  years: 'tahun',
  year: 'tahun',
};

const dateFormatter = createDateTimeFormatter({
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const dateTimeFormatter = createDateTimeFormatter({
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Format a date with a pattern.
 *  Supported patterns (subset of date-fns):
 *    'MMM d, yyyy'   → "Jan 15, 2026"
 *    'dd MMM yyyy, HH:mm' → "15 Jan 2026, 14:30"
 *  Other patterns are not supported — add a formatter when one is needed.
 */
export function format(date: Date | number, pattern: string): string {
  // ponytail: shared util — degrade bad inputs to '—' instead of throwing before the NaN guard.
  if (date === undefined || date === null || (typeof date !== 'number' && !(date instanceof Date))) return '—';
  const d = typeof date === 'number' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';

  // ponytail: only two patterns are used in the app; expand when a third shows up.
  if (pattern === 'dd MMM yyyy, HH:mm') return dateTimeFormatter.format(d);
  return dateFormatter.format(d);
}

function createDateTimeFormatter(
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat(LOCALE, options);
  } catch {
    return new Intl.DateTimeFormat(undefined, options);
  }
}

/** Format a date and time together, e.g. "15 Jan 2026, 14:30". */
export function formatDateTime(date: Date | number): string {
  return format(date, 'dd MMM yyyy, HH:mm');
}
