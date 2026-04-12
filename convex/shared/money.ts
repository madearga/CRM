/**
 * Money utilities — avoid floating point issues.
 * Store amounts in smallest currency unit.
 * IDR = Rupiah (no cents), USD = cents.
 */

/**
 * Convert display amount to storage (smallest unit).
 * For IDR: no conversion (already in Rupiah).
 * For USD/EUR: multiply by 100 (cents).
 */
export function toStorageAmount(
  displayAmount: number,
  currency: string
): number {
  if (currency === "IDR") return Math.round(displayAmount);
  return Math.round(displayAmount * 100);
}

/**
 * Convert storage amount to display value.
 */
export function toDisplayAmount(
  storageAmount: number,
  currency: string
): number {
  if (currency === "IDR") return storageAmount;
  return storageAmount / 100;
}

/**
 * Format money for display.
 * IDR: "Rp 500.000"
 * USD: "$500.00"
 */
export function formatMoney(amount: number, currency: string): string {
  if (currency === "IDR") {
    return `Rp ${amount.toLocaleString("id-ID")}`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount / 100);
}
