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
import { Search, MoreHorizontal, XCircle, Landmark, FileWarning } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/format';
import { PaymentMethodBadge } from '@/components/invoices/payment-method-badge';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { ui, getErrorMessage } from '@/lib/ui-messages';

const stateConfig: Record<string, { label: string; color: string }> = {
  confirmed: { label: 'Terkonfirmasi', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400' },
  cancelled: { label: 'Dibatalkan', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
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

  const { confirm, dialog: confirmDialog } = useConfirmDialog();

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

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  const confirmedPayments = payments.filter((p: Payment) => p.state === 'confirmed');
  const pageTotal = confirmedPayments.reduce((sum, p) => sum + p.amount, 0);

  const handleCancel = async (payment: Payment) => {
    const ok = await confirm({
      title: 'Batalkan Pembayaran',
      description: `Pembayaran sebesar ${formatCurrency(payment.amount)} akan dibatalkan. Invoice terkait akan diperbarui dan sisa tagihan dikembalikan.`,
      confirmLabel: 'Batalkan Pembayaran',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await cancelMutation.mutateAsync({ id: payment.id });
      ui.success.cancelled('Pembayaran');
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Gagal membatalkan pembayaran.'));
    }
  };

  return (
    <div className="space-y-6">
      {confirmDialog}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Landmark className="h-6 w-6" />
            Pembayaran
          </h1>
          <p className="text-sm text-muted-foreground">
            Lacak pembayaran masuk dan keluar.
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Total Terkonfirmasi</p>
          <p className="text-xl font-bold">{formatCurrency(pageTotal)}</p>
          {payments.length >= 50 && (
            <p className="text-xs text-muted-foreground">Menampilkan halaman pertama</p>
          )}
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari berdasarkan referensi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={methodFilter || 'all'} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Semua Metode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Metode</SelectItem>
            <SelectItem value="bank_transfer">Transfer Bank</SelectItem>
            <SelectItem value="cash">Tunai</SelectItem>
            <SelectItem value="credit_card">Kartu Kredit</SelectItem>
            <SelectItem value="debit_card">Kartu Debit</SelectItem>
            <SelectItem value="e_wallet">E-Wallet</SelectItem>
            <SelectItem value="cheque">Cek</SelectItem>
            <SelectItem value="other">Lainnya</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Perusahaan</TableHead>
                <TableHead>Metode</TableHead>
                <TableHead>Referensi</TableHead>
                <TableHead>Jumlah</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Memuat data pembayaran...
                  </TableCell>
                </TableRow>
              ) : payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <FileWarning className="h-10 w-10 text-muted-foreground/50" />
                      <div>
                        <p className="font-medium text-foreground">
                          {search || methodFilter ? 'Tidak ada pembayaran yang cocok' : 'Belum ada pembayaran'}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {search || methodFilter
                            ? 'Coba ubah filter atau kata kunci pencarian.'
                            : 'Pembayaran dicatat dari halaman detail invoice.'}
                        </p>
                      </div>
                    </div>
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
                                onClick={() => handleCancel(p)}
                              >
                                <XCircle className="mr-2 h-4 w-4" /> Batalkan Pembayaran
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
