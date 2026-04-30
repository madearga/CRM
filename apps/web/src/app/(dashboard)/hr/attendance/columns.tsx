'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUpDown } from 'lucide-react';

const statusLabels: Record<string, string> = {
  present: 'Hadir',
  absent: 'Alpha',
  on_leave: 'Cuti',
  holiday: 'Libur',
};

const labelDisplay: Record<string, string> = {
  on_time: 'Tepat Waktu',
  late: 'Terlambat',
  early_leave: 'Pulang Awal',
  no_shift: 'Tanpa Shift',
  forgot_clockout: 'Lupa Checkout',
  outside_area: 'Luar Area',
};

export type AttendanceRow = {
  id: string;
  date: string;
  employeeName: string;
  branchName?: string;
  clockIn: string | null;
  clockOut: string | null;
  status: string;
  label: string | null;
  lateMinutes: number | null;
  totalWorkHours: number | null;
};

export function getColumns(): ColumnDef<AttendanceRow>[] {
  return [
    {
      accessorKey: 'date',
      header: ({ column }) => (
        <Button variant="ghost" size="sm" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Date <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
    },
    {
      accessorKey: 'employeeName',
      header: 'Employee',
    },
    {
      accessorKey: 'clockIn',
      header: 'Clock In',
      cell: ({ row }) => row.original.clockIn ?? '—',
    },
    {
      accessorKey: 'clockOut',
      header: 'Clock Out',
      cell: ({ row }) => row.original.clockOut ?? '—',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.status === 'present' ? 'default' : row.original.status === 'absent' ? 'destructive' : 'secondary'}>
          {statusLabels[row.original.status] ?? row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'label',
      header: 'Label',
      cell: ({ row }) =>
        row.original.label ? (
          <Badge variant="outline" className="text-xs">{labelDisplay[row.original.label] ?? row.original.label}</Badge>
        ) : null,
    },
    {
      accessorKey: 'totalWorkHours',
      header: 'Hours',
      cell: ({ row }) => (row.original.totalWorkHours != null ? `${row.original.totalWorkHours}h` : '—'),
    },
  ];
}
