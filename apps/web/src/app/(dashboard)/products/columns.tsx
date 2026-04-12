"use client";

import { memo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Package } from "lucide-react";
import Link from "next/link";
import { DataTableColumnHeader } from "@/components/data-table";

export type ProductRow = {
  id: string;
  name: string;
  type: string;
  category?: string | null;
  sku?: string | null;
  price?: number | null;
  cost?: number | null;
  unit?: string | null;
  active?: boolean | null;
  archivedAt?: number | null;
};

const TYPE_COLORS: Record<string, string> = {
  storable: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  consumable: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  service: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

const NameCell = memo(({ id, name, sku }: { id: string; name: string; sku?: string | null }) => (
  <div className="flex items-center gap-3">
    <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
      <Package className="size-4" />
    </div>
    <div>
      <Link href={`/products/${id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
        {name}
      </Link>
      {sku && (
        <div className="text-xs text-muted-foreground">
          {sku}
        </div>
      )}
    </div>
  </div>
));
NameCell.displayName = "NameCell";

const TypeBadge = memo(({ type, archivedAt }: { type: string; archivedAt?: number | null }) => (
  <div>
    <Badge variant="secondary" className={TYPE_COLORS[type] ?? ""}>
      {type}
    </Badge>
    {archivedAt && (
      <Badge variant="secondary" className="ml-1 bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400">
        archived
      </Badge>
    )}
  </div>
));
TypeBadge.displayName = "TypeBadge";

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
}): ColumnDef<ProductRow>[] {
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
      header: ({ column }) => <DataTableColumnHeader column={column} title="Product" />,
      size: 280,
      cell: ({ row }) => <NameCell id={row.original.id} name={row.original.name} sku={row.original.sku} />,
    },
    {
      id: "type",
      accessorKey: "type",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
      size: 120,
      cell: ({ row }) => <TypeBadge type={row.original.type} archivedAt={row.original.archivedAt} />,
    },
    {
      id: "category",
      accessorKey: "category",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Category" />,
      size: 140,
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.category ?? "—"}</span>,
    },
    {
      id: "price",
      accessorKey: "price",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Price" />,
      size: 120,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.price != null ? `Rp ${row.original.price.toLocaleString("id-ID")}` : "—"}
        </span>
      ),
    },
    {
      id: "cost",
      accessorKey: "cost",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Cost" />,
      size: 120,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.cost != null ? `Rp ${row.original.cost.toLocaleString("id-ID")}` : "—"}
        </span>
      ),
    },
    {
      id: "unit",
      accessorKey: "unit",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Unit" />,
      size: 80,
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.unit ?? "—"}</span>,
    },
    {
      id: "actions",
      header: "",
      size: 80,
      enableSorting: false,
      cell: () => null,
    },
  ];
}
