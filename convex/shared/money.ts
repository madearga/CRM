/**
 * Money utilities — avoid floating point issues.
 * Store amounts in smallest currency unit.
 * IDR = Rupiah (no cents), USD = cents.
 *
 * For IDR: amounts stored as-is (already in Rupiah).
 * For USD/EUR: amounts stored in cents (× 100).
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
 * IDR: "Rp 500.000" (no decimals)
 * USD: "$500.00"
 */
export function formatMoney(amount: number | null | undefined, currency: string = "IDR"): string {
  if (amount == null) return "—";
  if (currency === "IDR") {
    return `Rp ${amount.toLocaleString("id-ID")}`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount / 100);
}

/**
 * Format money with explicit + prefix (for variant extras).
 */
export function formatMoneyExtra(amount: number | null | undefined, currency: string = "IDR"): string {
  if (amount == null) return "—";
  const formatted = formatMoney(Math.abs(amount), currency);
  return amount >= 0 ? `+${formatted}` : `-${formatted}`;
}
