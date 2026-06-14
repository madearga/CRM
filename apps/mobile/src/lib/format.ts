/**
 * Number/currency formatting helpers (mobile).
 *
 * Mirrored from `apps/web/src/lib/format.ts` — NOT imported across apps (see
 * the mobile plan). `Intl.NumberFormat` is available in Hermes, so this is
 * React Native safe with zero extra dependencies.
 */

/** Format a number as currency with locale-aware formatting. */
export function formatCurrency(
  value: number,
  currency: string = 'IDR'
): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Compact currency formatter for dashboard tiles where the full amount may be
 * long (e.g. "Rp 12,4 jt" instead of "Rp 12.400.000"). Falls back to the full
 * `formatCurrency` representation for amounts below one million.
 */
export function formatCurrencyCompact(
  value: number,
  currency: string = 'IDR'
): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 1_000_000_000) {
    return `${sign}${compactSymbol(abs / 1_000_000_000, 'M')}`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${compactSymbol(abs / 1_000_000, 'jt')}`;
  }
  if (abs >= 1_000) {
    return `${sign}${compactSymbol(abs / 1_000, 'rb')}`;
  }
  return formatCurrency(value, currency);
}

function compactSymbol(value: number, suffix: string): string {
  const locale = new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 1,
  }).format(value);
  return `Rp ${locale} ${suffix}`;
}
