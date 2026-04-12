"use client";

import { memo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Edit, Copy } from "lucide-react";
import Link from "next/link";
import { DataTableColumnHeader } from "@/components/data-table";
import { formatMoney } from "@/lib/format-money";

export type SaleOrderRow = {
  id: string;
  number: string;
  state: string;
  orderDate: number;
  totalAmount: number;
  currency?: string | null;
  companyName?: string | null;
  contactName?: string | null;
  invoiceStatus?: string | null;
  archivedAt?: number | null;
};

const STATE_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  confirmed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  invoiced: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  delivered: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  cancel: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const NumberCell = memo(({ id, number }: { id: string; number: string }) => (
  <div className="flex items-center gap-3">
    <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
      <ShoppingCart className="size-4" />
    </div>
    <Link href={`/sales/${id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
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
}): ColumnDef<SaleOrderRow>[] {
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
      header: ({ column }) => <DataTableColumnHeader column={column} title="Order" />,
      size: 200,
      cell: ({ row }) => <NumberCell id={row.original.id} number={row.original.number} />,
    },
    {
      id: "state",
      accessorKey: "state",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      size: 120,
      cell: ({ row }) => <StateBadge state={row.original.state} archivedAt={row.original.archivedAt} />,
    },
    {
      id: "customer",
      accessorKey: "companyName",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
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
        <span className="font-medium">{formatMoney(row.original.totalAmount)}</span>
      ),
    },
    {
      id: "orderDate",
      accessorKey: "orderDate",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
      size: 120,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {new Date(row.original.orderDate).toLocaleDateString('id-ID')}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      size: 100,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/sales/${row.original.id}/edit`}>
              <Edit className="h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/sales/${row.original.id}`}>
              <Copy className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      ),
    },
  ];
}
