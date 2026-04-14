/**
 * Format a number as Indonesian Rupiah (IDR).
 * e.g. 1500000 → "Rp 1.500.000"
 */
export function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
