"use client";

import { memo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { FileText, Edit, ExternalLink } from "lucide-react";
import Link from "next/link";
import { DataTableColumnHeader } from "@/components/data-table";
import { formatMoney } from "@/lib/format-money";
import { cn } from "@/lib/utils";

export type InvoiceRow = {
  id: string;
  number: string;
  type: "customer_invoice" | "vendor_bill" | "credit_note";
  state: "draft" | "posted" | "paid" | "cancel";
  invoiceDate: number;
  dueDate: number;
  totalAmount: number;
  amountDue: number;
  currency?: string | null;
  paymentStatus?: "unpaid" | "partially_paid" | "paid" | null;
  companyName?: string | null;
  contactName?: string | null;
  archivedAt?: number | null;
};

const STATE_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400",
  posted: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  cancel: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const TYPE_COLORS: Record<string, string> = {
  customer_invoice: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  vendor_bill: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  credit_note: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  unpaid: "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400",
  partially_paid: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

const TYPE_LABELS: Record<string, string> = {
  customer_invoice: "Customer Invoice",
  vendor_bill: "Vendor Bill",
  credit_note: "Credit Note",
};

const NumberCell = memo(({ id, number }: { id: string; number: string }) => (
  <div className="flex items-center gap-3">
    <div className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-900/40 dark:text-slate-400">
      <FileText className="size-4" />
    </div>
    <Link href={`/invoices/${id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
      {number}
    </Link>
  </div>
));
NumberCell.displayName = "NumberCell";

const StateBadge = memo(({ state, archivedAt }: { state: string; archivedAt?: number | null }) => (
  <div>
    <Badge variant="secondary" className={STATE_COLORS[state] ?? ""}>
      {state}
    </Badge>
    {archivedAt && (
      <Badge variant="secondary" className="ml-1 bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400">
        archived
      </Badge>
    )}
  </div>
));
StateBadge.displayName = "StateBadge";

export function getColumns({
  selectedIds,
  toggleOne,
  allIds,
  toggleAll,
}: {
  selectedIds: Set<string>;
  toggleOne: (id: string) => void;
  allIds: string[];
  toggleAll: () => void;
}): ColumnDef<InvoiceRow>[] {
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const someSelected = !allSelected && allIds.some((id) => selectedIds.has(id));

  return [
    {
      id: "select",
      size: 40,
      header: () => (
        <Checkbox
          checked={allSelected || (someSelected && "indeterminate")}
          onCheckedChange={() => toggleAll()}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={selectedIds.has(row.original.id)}
          onCheckedChange={() => toggleOne(row.original.id)}
          aria-label={`Select ${row.original.number}`}
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "number",
      accessorKey: "number",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Invoice" />,
      size: 200,
      cell: ({ row }) => <NumberCell id={row.original.id} number={row.original.number} />,
    },
    {
      id: "type",
      accessorKey: "type",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
      size: 150,
      cell: ({ row }) => (
        <Badge variant="secondary" className={TYPE_COLORS[row.original.type] ?? ""}>
          {TYPE_LABELS[row.original.type] ?? row.original.type}
        </Badge>
      ),
    },
    {
      id: "customer",
      accessorKey: "companyName",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Customer/Vendor" />,
      size: 180,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.companyName ?? row.original.contactName ?? "—"}
        </span>
      ),
    },
    {
      id: "total",
      accessorKey: "totalAmount",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Total" />,
      size: 140,
      cell: ({ row }) => (
        <span className="font-medium">{formatMoney(row.original.totalAmount, row.original.currency ?? "IDR")}</span>
      ),
    },
    {
      id: "paymentStatus",
      accessorKey: "paymentStatus",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Payment" />,
      size: 140,
      cell: ({ row }) => (
        row.original.paymentStatus ? (
          <Badge variant="secondary" className={PAYMENT_STATUS_COLORS[row.original.paymentStatus] ?? ""}>
            {row.original.paymentStatus}
          </Badge>
        ) : "—"
      ),
    },
    {
      id: "state",
      accessorKey: "state",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      size: 120,
      cell: ({ row }) => <StateBadge state={row.original.state} archivedAt={row.original.archivedAt} />,
    },
    {
      id: "dueDate",
      accessorKey: "dueDate",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Due Date" />,
      size: 140,
      cell: ({ row }) => {
        const isOverdue = row.original.dueDate < Date.now() && !["paid", "cancel"].includes(row.original.state);
        return (
          <span className={cn("text-muted-foreground", isOverdue && "font-medium text-red-600 dark:text-red-400")}>
            {new Date(row.original.dueDate).toLocaleDateString('id-ID')}
            {isOverdue && " (Overdue)"}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "",
      size: 100,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/invoices/${row.original.id}/edit`}>
              <Edit className="h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/invoices/${row.original.id}`}>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      ),
    },
  ];
}
