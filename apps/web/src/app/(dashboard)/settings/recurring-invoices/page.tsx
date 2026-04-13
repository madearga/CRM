'use client';

import { useState } from 'react';
import { useAuthQuery, useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, MoreHorizontal, Pause, Play, XCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { CreateRecurringInvoiceDialog } from '@/components/recurring-invoice/create-dialog';

type StatusFilter = 'all' | 'active' | 'paused' | 'expired';

const statusTabs: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Paused', value: 'paused' },
  { label: 'Expired', value: 'expired' },
];

const frequencyLabels: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'active':
      return (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
          Active
        </Badge>
      );
    case 'paused':
      return (
        <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400">
          Paused
        </Badge>
      );
    case 'expired':
      return (
        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
          Expired
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export default function RecurringInvoicesPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: recurringInvoices, isLoading } = useAuthQuery(
    api.recurringInvoices.list,
    statusFilter === 'all' ? {} : { status: statusFilter },
  );

  const pauseMutation = useAuthMutation(api.recurringInvoices.pause, {
    onSuccess: () => toast.success('Recurring invoice paused'),
    onError: (err: any) => toast.error(err.data?.message ?? 'Failed to pause'),
  });

  const resumeMutation = useAuthMutation(api.recurringInvoices.resume, {
    onSuccess: () => toast.success('Recurring invoice resumed'),
    onError: (err: any) => toast.error(err.data?.message ?? 'Failed to resume'),
  });

  const cancelMutation = useAuthMutation(api.recurringInvoices.cancel, {
    onSuccess: () => toast.success('Recurring invoice cancelled'),
    onError: (err: any) => toast.error(err.data?.message ?? 'Failed to cancel'),
  });

  const items = (recurringInvoices as any[]) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Recurring Invoices</h1>
          <p className="text-sm text-muted-foreground">
            Manage invoices that are generated automatically on a schedule.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> New Recurring Invoice
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        {statusTabs.map((tab) => (
          <Button
            key={tab.value}
            variant={statusFilter === tab.value ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setStatusFilter(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Next Date</TableHead>
                <TableHead className="text-center">Occurrences</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Company / Contact</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-muted-foreground py-8"
                  >
                    Loading...
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-muted-foreground py-8"
                  >
                    No recurring invoices found. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((ri: any) => (
                  <TableRow key={ri.id}>
                    <TableCell className="font-medium font-mono text-xs">
                      {ri.number}
                    </TableCell>
                    <TableCell>{ri.name ?? '—'}</TableCell>
                    <TableCell>
                      <StatusBadge status={ri.status} />
                    </TableCell>
                    <TableCell>
                      {frequencyLabels[ri.frequency] ?? ri.frequency}
                    </TableCell>
                    <TableCell>
                      {new Date(ri.nextInvoiceDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-center">
                      {ri.occurredCount}
                      {ri.maxOccurrences ? ` / ${ri.maxOccurrences}` : ''}
                    </TableCell>
                    <TableCell>
                      {ri.totalAmount?.toLocaleString()}{' '}
                      {ri.currency ?? ''}
                    </TableCell>
                    <TableCell>
                      <div>
                        {ri.companyName ? (
                          <span className="text-sm">{ri.companyName}</span>
                        ) : null}
                        {ri.contactName && (
                          <span className="block text-xs text-muted-foreground">
                            {ri.contactName}
                          </span>
                        )}
                        {!ri.companyName && !ri.contactName && '—'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {ri.status === 'active' && (
                            <DropdownMenuItem
                              onClick={() =>
                                pauseMutation.mutate({ id: ri.id as any })
                              }
                            >
                              <Pause className="mr-2 h-4 w-4" /> Pause
                            </DropdownMenuItem>
                          )}
                          {ri.status === 'paused' && (
                            <DropdownMenuItem
                              onClick={() =>
                                resumeMutation.mutate({ id: ri.id as any })
                              }
                            >
                              <Play className="mr-2 h-4 w-4" /> Resume
                            </DropdownMenuItem>
                          )}
                          {(ri.status === 'active' || ri.status === 'paused') && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() =>
                                cancelMutation.mutate({ id: ri.id as any })
                              }
                            >
                              <XCircle className="mr-2 h-4 w-4" /> Cancel
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <CreateRecurringInvoiceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
