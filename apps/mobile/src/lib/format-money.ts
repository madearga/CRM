/**
 * Hermes-safe money formatting for the mobile app.
 *
 * Mirrors the web `formatMoney` output (IDR → "Rp 1.234.567") but does NOT
 * rely on ICU locale data bundled with the Hermes JS engine. Grouping is
 * computed manually so the rendered string is identical on every device
 * regardless of locale support, and never throws on a missing locale.
 *
 * This is a mobile-only utility; the web app keeps its own `@/lib/format-money`.
 * Do not re-export this to web.
 */

/** Group a digit-only string into thousands using `separator`. */
function groupThousands(digits: string, separator: string): string {
  if (digits.length <= 3) return digits;
  const out: string[] = [];
  for (let i = digits.length; i > 0; i -= 3) {
    out.unshift(digits.slice(Math.max(0, i - 3), i));
  }
  return out.join(separator);
}

export function formatMoney(
  amount: number | null | undefined,
  currency: string = 'IDR',
): string {
  if (amount == null || Number.isNaN(amount)) return '—';

  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);

  if (currency === 'IDR') {
    // Rupiah has no minor unit; round to whole and group with dots (id-ID).
    const intPart = Math.round(abs).toString();
    return `Rp ${sign}${groupThousands(intPart, '.')}`;
  }

  // Generic fallback for other currencies: 2 decimals, comma grouping.
  const rounded = Math.round(abs * 100) / 100;
  const [intPart, fracPart] = rounded.toFixed(2).split('.');
  return `${currency} ${sign}${groupThousands(intPart, ',')}.${fracPart}`;
}
