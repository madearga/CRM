'use client';

import { memo } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { FileText, Edit, Copy } from 'lucide-react';
import Link from 'next/link';
import { DataTableColumnHeader } from '@/components/data-table';

export type TemplateRow = {
  id: string;
  name: string;
  description?: string;
  discountAmount?: number;
  discountType?: 'percentage' | 'fixed';
  lineCount: number;
  isDefault?: boolean;
  archivedAt?: number | null;
};

const NameCell = memo(({ id, name }: { id: string; name: string }) => (
  <div className="flex items-center gap-3">
    <div className="flex size-9 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400">
      <FileText className="size-4" />
    </div>
    <Link href={`/templates/${id}/edit`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
      {name}
    </Link>
  </div>
));
NameCell.displayName = 'NameCell';

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
}): ColumnDef<TemplateRow>[] {
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const someSelected = !allSelected && allIds.some((id) => selectedIds.has(id));

  return [
    {
      id: 'select',
      size: 40,
      header: () => (
        <Checkbox
          checked={allSelected || (someSelected && 'indeterminate')}
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
      id: 'name',
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Template" />,
      size: 220,
      cell: ({ row }) => <NameCell id={row.original.id} name={row.original.name} />,
    },
    {
      id: 'description',
      accessorKey: 'description',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Description" />,
      size: 200,
      cell: ({ row }) => (
        <span className="text-muted-foreground line-clamp-1">
          {row.original.description ?? '—'}
        </span>
      ),
    },
    {
      id: 'lineCount',
      accessorKey: 'lineCount',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Lines" />,
      size: 80,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.lineCount}</span>
      ),
    },
    {
      id: 'isDefault',
      accessorKey: 'isDefault',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Default" />,
      size: 90,
      cell: ({ row }) => row.original.isDefault ? (
        <Badge variant="secondary" className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">Default</Badge>
      ) : null,
    },
    {
      id: 'actions',
      header: '',
      size: 100,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/templates/${row.original.id}/edit`}>
              <Edit className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      ),
    },
  ];
}
