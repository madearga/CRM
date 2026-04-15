'use client';

import { useState } from 'react';
import { useAuthPaginatedQuery, useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search, MoreHorizontal, XCircle, Landmark } from 'lucide-react';
import { toast } from 'sonner';
import { PaymentMethodBadge } from '@/components/invoices/payment-method-badge';
import { formatCurrency } from '@/lib/format';

const stateConfig: Record<string, { label: string; color: string }> = {
  confirmed: { label: 'Confirmed', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
};

type PaymentMethod = 'bank_transfer' | 'cash' | 'credit_card' | 'debit_card' | 'e_wallet' | 'cheque' | 'other';

type Payment = {
  id: Id<'payments'>;
  amount: number;
  paymentDate: number;
  method: PaymentMethod;
  reference?: string;
  memo?: string;
  state: 'draft' | 'confirmed' | 'cancelled';
  invoiceId?: Id<'invoices'>;
  companyId?: Id<'companies'>;
  companyName?: string;
};

export default function PaymentsPage() {
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('');

  const { data, isLoading } = useAuthPaginatedQuery(
    api.payments.list,
    {
      search: search || undefined,
      method: methodFilter && methodFilter !== 'all' ? (methodFilter as PaymentMethod) : undefined,
    },
    { initialNumItems: 50 },
  );

  const cancelMutation = useAuthMutation(api.payments.cancel);

  const payments = data ?? [];

  const handleCancel = async (id: Id<'payments'>) => {
    if (!confirm('Cancel this payment? This will reverse the payment and update the linked invoice.')) return;
    try {
      await cancelMutation.mutateAsync({ id });
      toast.success('Payment cancelled');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as any)?.data?.message ?? 'Failed to cancel';
      toast.error(msg);
    }
  };

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  const confirmedPayments = payments.filter((p: Payment) => p.state === 'confirmed');
  const pageTotal = confirmedPayments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Landmark className="h-6 w-6" />
            Payments
          </h1>
          <p className="text-sm text-muted-foreground">
            Track incoming and outgoing payments.
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Total Confirmed</p>
          <p className="text-xl font-bold">{formatCurrency(pageTotal)}</p>
          {payments.length >= 50 && (
            <p className="text-xs text-muted-foreground">Showing first page</p>
          )}
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={methodFilter || 'all'} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Methods" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="credit_card">Credit Card</SelectItem>
            <SelectItem value="debit_card">Debit Card</SelectItem>
            <SelectItem value="e_wallet">E-Wallet</SelectItem>
            <SelectItem value="cheque">Cheque</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No payments found. Payments are registered from invoice detail pages.
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((p: Payment) => {
                  const sc = stateConfig[p.state] ?? stateConfig.draft;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        {formatDate(p.paymentDate)}
                      </TableCell>
                      <TableCell>
                        {p.companyName || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <PaymentMethodBadge method={p.method} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {p.reference || '—'}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(p.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge className={sc.color}>{sc.label}</Badge>
                      </TableCell>
                      <TableCell>
                        {p.state === 'confirmed' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleCancel(p.id)}
                              >
                                <XCircle className="mr-2 h-4 w-4" /> Cancel Payment
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
