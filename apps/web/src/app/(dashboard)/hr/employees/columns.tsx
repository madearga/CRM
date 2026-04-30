'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUpDown } from 'lucide-react';

const statusLabels: Record<string, string> = {
  active: 'Aktif',
  on_leave: 'Cuti',
  resigned: 'Resign',
};

const statusColors: Record<string, 'default' | 'secondary' | 'destructive'> = {
  active: 'default',
  on_leave: 'secondary',
  resigned: 'destructive',
};

export type EmployeeRow = {
  id: string;
  name: string;
  nik: string;
  position: string;
  department: string | null | undefined;
  branchName?: string;
  status: string;
  phone: string | null | undefined;
  whatsappNumber: string | null | undefined;
};

export function getColumns(): ColumnDef<EmployeeRow>[] {
  return [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <Button variant="ghost" size="sm" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Name <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
    },
    {
      accessorKey: 'nik',
      header: 'NIK',
    },
    {
      accessorKey: 'position',
      header: 'Position',
    },
    {
      accessorKey: 'department',
      header: 'Department',
      cell: ({ row }) => row.original.department ?? '—',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={statusColors[row.original.status] ?? 'secondary'}>
          {statusLabels[row.original.status] ?? row.original.status}
        </Badge>
      ),
    },
  ];
}
