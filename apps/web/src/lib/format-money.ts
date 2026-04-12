/**
 * Format money for display on the frontend.
 * Defaults to IDR (Indonesian Rupiah).
 *
 * Shared utility so all components use consistent formatting.
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

export function formatMoneyExtra(amount: number | null | undefined, currency: string = "IDR"): string {
  if (amount == null) return "—";
  const formatted = formatMoney(Math.abs(amount), currency);
  return amount >= 0 ? `+${formatted}` : `-${formatted}`;
}
