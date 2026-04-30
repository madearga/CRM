'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, QrCode } from 'lucide-react';

export type BranchRow = {
  id: string;
  name: string;
  address: string | null | undefined;
  phone: string | null | undefined;
  qrCode: string;
  isActive: boolean;
  createdAt: number;
};

export function getColumns(opts: {
  onRegenerateQr: (id: string) => void;
}): ColumnDef<BranchRow>[] {
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
      accessorKey: 'address',
      header: 'Address',
      cell: ({ row }) => row.original.address ?? '—',
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      cell: ({ row }) => row.original.phone ?? '—',
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? 'default' : 'secondary'}>
          {row.original.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => opts.onRegenerateQr(row.original.id)}
          title="Regenerate QR Code"
        >
          <QrCode className="h-4 w-4" />
        </Button>
      ),
    },
  ];
}
