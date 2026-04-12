import { Badge } from "@/components/ui/badge";
import { memo } from "react";

const TYPE_COLORS: Record<string, string> = {
  customer_invoice: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  vendor_bill: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  credit_note: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
};

const TYPE_LABELS: Record<string, string> = {
  customer_invoice: "Customer Invoice",
  vendor_bill: "Vendor Bill",
  credit_note: "Credit Note",
};

export const InvoiceTypeBadge = memo(({ type }: { type: string }) => (
  <Badge variant="secondary" className={TYPE_COLORS[type] ?? ""}>
    {TYPE_LABELS[type] ?? type}
  </Badge>
));
InvoiceTypeBadge.displayName = "InvoiceTypeBadge";
