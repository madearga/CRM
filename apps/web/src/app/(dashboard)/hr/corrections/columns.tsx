'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';

const statusLabels: Record<string, string> = {
  pending: 'Menunggu',
  approved: 'Disetujui',
  rejected: 'Ditolak',
};

export type CorrectionRow = {
  id: string;
  employeeName: string;
  date: string;
  correctedClockIn: string | null;
  correctedClockOut: string | null;
  reason: string;
  status: string;
};

export function getColumns(opts: {
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}): ColumnDef<CorrectionRow>[] {
  return [
    {
      accessorKey: 'employeeName',
      header: 'Employee',
    },
    {
      accessorKey: 'date',
      header: 'Date',
    },
    {
      accessorKey: 'reason',
      header: 'Reason',
    },
    {
      accessorKey: 'correctedClockIn',
      header: 'Corrected In',
      cell: ({ row }) => row.original.correctedClockIn ?? '—',
    },
    {
      accessorKey: 'correctedClockOut',
      header: 'Corrected Out',
      cell: ({ row }) => row.original.correctedClockOut ?? '—',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.status === 'approved' ? 'default' : row.original.status === 'rejected' ? 'destructive' : 'secondary'}>
          {statusLabels[row.original.status] ?? row.original.status}
        </Badge>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) =>
        row.original.status === 'pending' ? (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => opts.onApprove(row.original.id)} title="Approve">
              <Check className="h-4 w-4 text-green-600" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => opts.onReject(row.original.id)} title="Reject">
              <X className="h-4 w-4 text-red-600" />
            </Button>
          </div>
        ) : null,
    },
  ];
}
