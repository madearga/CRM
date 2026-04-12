import { Badge } from "@/components/ui/badge";
import { memo } from "react";
import { Landmark, Banknote, CreditCard, Wallet, Scroll, HelpCircle } from "lucide-react";

const METHOD_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  bank_transfer: { label: "Bank Transfer", icon: Landmark, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  cash: { label: "Cash", icon: Banknote, color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  credit_card: { label: "Credit Card", icon: CreditCard, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  debit_card: { label: "Debit Card", icon: CreditCard, color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" },
  e_wallet: { label: "E-Wallet", icon: Wallet, color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  cheque: { label: "Cheque", icon: Scroll, color: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400" },
  other: { label: "Other", icon: HelpCircle, color: "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400" },
};

export const PaymentMethodBadge = memo(({ method }: { method: string }) => {
  const config = METHOD_CONFIG[method] || METHOD_CONFIG.other;
  const Icon = config.icon;

  return (
    <Badge variant="secondary" className={config.color}>
      <Icon className="mr-1 h-3 w-3" />
      {config.label}
    </Badge>
  );
});
PaymentMethodBadge.displayName = "PaymentMethodBadge";
