"use client";

import { memo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { RefreshCw, Edit, ExternalLink } from "lucide-react";
import Link from "next/link";
import { DataTableColumnHeader } from "@/components/data-table";
import { cn } from "@/lib/utils";

export type SubscriptionRow = {
  id: string;
  name: string;
  interval: "weekly" | "monthly" | "quarterly" | "yearly";
  billingDay: number;
  nextBillingDate?: number | null;
  generatedCount?: number | null;
  numberOfInvoices?: number | null;
  state?: "active" | "paused" | "expired" | "cancelled" | null;
  companyName?: string | null;
  contactName?: string | null;
  currency?: string | null;
  lineCount: number;
  archivedAt?: number | null;
};

const INTERVAL_COLORS: Record<string, string> = {
  weekly: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  monthly: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  quarterly: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  yearly: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

const STATE_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  paused: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  expired: "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const NameCell = memo(({ id, name }: { id: string; name: string }) => (
  <div className="flex items-center gap-3">
    <div className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-900/40 dark:text-slate-400">
      <RefreshCw className="size-4" />
    </div>
    <Link href={`/subscriptions/${id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
      {name}
    </Link>
  </div>
));
NameCell.displayName = "NameCell";

const StateBadge = memo(({ state, archivedAt }: { state?: string | null; archivedAt?: number | null }) => (
  <div>
    <Badge variant="secondary" className={STATE_COLORS[state ?? "active"] ?? ""}>
      {state ?? "active"}
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
}): ColumnDef<SubscriptionRow>[] {
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
          aria-label={`Select ${row.original.name}`}
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Subscription" />,
      size: 200,
      cell: ({ row }) => <NameCell id={row.original.id} name={row.original.name} />,
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
      id: "interval",
      accessorKey: "interval",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Interval" />,
      size: 120,
      cell: ({ row }) => (
        <Badge variant="secondary" className={INTERVAL_COLORS[row.original.interval] ?? ""}>
          {row.original.interval}
        </Badge>
      ),
    },
    {
      id: "nextBillingDate",
      accessorKey: "nextBillingDate",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Next Billing" />,
      size: 140,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.nextBillingDate
            ? new Date(row.original.nextBillingDate).toLocaleDateString('id-ID')
            : "—"}
        </span>
      ),
    },
    {
      id: "generatedCount",
      accessorKey: "generatedCount",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Generated" />,
      size: 100,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.generatedCount ?? 0}{row.original.numberOfInvoices ? `/${row.original.numberOfInvoices}` : ''}
        </span>
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
      id: "actions",
      header: "",
      size: 100,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/subscriptions/${row.original.id}/edit`}>
              <Edit className="h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/subscriptions/${row.original.id}`}>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      ),
    },
  ];
}
