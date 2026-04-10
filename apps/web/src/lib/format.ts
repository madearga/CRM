/** Format a number as currency with locale-aware formatting. */
export function formatCurrency(value: number, currency: string = 'IDR'): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}
