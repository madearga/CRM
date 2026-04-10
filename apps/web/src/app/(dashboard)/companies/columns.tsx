"use client";

import { memo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Building2, Globe } from "lucide-react";
import Link from "next/link";
import { STATUS_COLORS } from "@/lib/constants";
import { DataTableColumnHeader } from "@/components/data-table";

export type CompanyRow = {
  id: string;
  name: string;
  website?: string | null;
  industry?: string | null;
  country?: string | null;
  source?: string | null;
  status?: string | null;
  archivedAt?: number | null;
};

const NameCell = memo(({ id, name, website }: { id: string; name: string; website?: string | null }) => (
  <div className="flex items-center gap-3">
    <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
      <Building2 className="size-4" />
    </div>
    <div>
      <Link href={`/companies/${id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
        {name}
      </Link>
      {website && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Globe className="h-3 w-3" />
          {website.replace(/^https?:\/\//, "")}
        </div>
      )}
    </div>
  </div>
));
NameCell.displayName = "NameCell";

const StatusCell = memo(({ status, archivedAt }: { status?: string | null; archivedAt?: number | null }) => (
  <div>
    {status ? (
      <Badge variant="secondary" className={STATUS_COLORS[status] ?? ""}>
        {status}
      </Badge>
    ) : (
      <span className="text-muted-foreground">—</span>
    )}
    {archivedAt && (
      <Badge variant="secondary" className="ml-1 bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400">
        archived
      </Badge>
    )}
  </div>
));
StatusCell.displayName = "StatusCell";

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
}): ColumnDef<CompanyRow>[] {
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
      header: ({ column }) => <DataTableColumnHeader column={column} title="Company" />,
      size: 280,
      cell: ({ row }) => <NameCell id={row.original.id} name={row.original.name} website={row.original.website} />,
    },
    {
      id: "industry",
      accessorKey: "industry",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Industry" />,
      size: 150,
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.industry ?? "—"}</span>,
    },
    {
      id: "country",
      accessorKey: "country",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Country" />,
      size: 120,
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.country ?? "—"}</span>,
    },
    {
      id: "source",
      accessorKey: "source",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Source" />,
      size: 120,
      cell: ({ row }) => <span className="capitalize text-muted-foreground">{row.original.source ?? "—"}</span>,
    },
    {
      id: "status",
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      size: 140,
      cell: ({ row }) => <StatusCell status={row.original.status} archivedAt={row.original.archivedAt} />,
    },
    {
      id: "actions",
      header: "",
      size: 80,
      enableSorting: false,
      cell: () => null, // Filled by page wrapper
    },
  ];
}
