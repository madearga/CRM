import { Badge } from "@/components/ui/badge";
import { memo } from "react";

const STATE_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400",
  posted: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  cancel: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export const InvoiceStatusBadge = memo(({ state }: { state: string }) => (
  <Badge variant="secondary" className={STATE_COLORS[state] ?? ""}>
    {state}
  </Badge>
));
InvoiceStatusBadge.displayName = "InvoiceStatusBadge";
