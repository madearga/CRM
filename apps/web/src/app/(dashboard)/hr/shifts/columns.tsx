'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, Trash2 } from 'lucide-react';

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export type ShiftRow = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  lateToleranceMinutes: number;
  daysOfWeek: number[];
  branchName?: string;
};

export function getColumns(opts: {
  onDelete: (id: string) => void;
}): ColumnDef<ShiftRow>[] {
  return [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <Button variant="ghost" size="sm" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Shift Name <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
    },
    {
      id: 'time',
      header: 'Time',
      cell: ({ row }) => `${row.original.startTime} — ${row.original.endTime}`,
    },
    {
      accessorKey: 'lateToleranceMinutes',
      header: 'Tolerance',
      cell: ({ row }) => `${row.original.lateToleranceMinutes} min`,
    },
    {
      accessorKey: 'daysOfWeek',
      header: 'Days',
      cell: ({ row }) => (
        <div className="flex gap-1 flex-wrap">
          {row.original.daysOfWeek.map((d) => (
            <Badge key={d} variant="outline" className="text-xs">{dayNames[d]}</Badge>
          ))}
        </div>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" onClick={() => opts.onDelete(row.original.id)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      ),
    },
  ];
}
