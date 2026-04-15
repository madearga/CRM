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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, MoreHorizontal, Edit, Trash2, Search, Percent, FileWarning } from 'lucide-react';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { ui, getErrorMessage } from '@/lib/ui-messages';

const scopeBadge: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  sales: { label: 'Sales', variant: 'default' },
  purchase: { label: 'Purchase', variant: 'secondary' },
  both: { label: 'Both', variant: 'outline' },
};

type TaxScope = 'sales' | 'purchase' | 'both';
type TaxType = 'percentage' | 'fixed';

type Tax = {
  id: Id<'taxes'>;
  name: string;
  rate: number;
  type: TaxType;
  scope: TaxScope;
  active?: boolean;
};

export default function TaxesPage() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<Tax | null>(null);
  const [form, setForm] = useState({
    name: '',
    rate: 0,
    type: 'percentage' as TaxType,
    scope: 'both' as TaxScope,
    active: true,
  });

  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const { data, isLoading } = useAuthPaginatedQuery(
    api.taxes.list,
    { search: search || undefined },
    { initialNumItems: 100 },
  );

  const createMutation = useAuthMutation(api.taxes.create);
  const updateMutation = useAuthMutation(api.taxes.update);
  const removeMutation = useAuthMutation(api.taxes.remove);

  const taxes = data ?? [];

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', rate: 0, type: 'percentage', scope: 'both', active: true });
    setDialogOpen(true);
  };

  const openEdit = (tax: Tax) => {
    setEditing(tax);
    setForm({
      name: tax.name,
      rate: tax.rate,
      type: tax.type,
      scope: tax.scope,
      active: tax.active ?? true,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      ui.error.validation('Nama pajak wajib diisi.');
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, ...form });
        ui.success.updated(`Pajak "${form.name}"`);
      } else {
        await createMutation.mutateAsync(form);
        ui.success.created(`Pajak "${form.name}"`);
      }
      setDialogOpen(false);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Gagal menyimpan pajak. Coba lagi.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (tax: Tax) => {
    const ok = await confirm({
      title: 'Hapus Pajak',
      description: `Pajak "${tax.name}" akan dihapus secara permanen. Tindakan ini tidak bisa dibatalkan.`,
      confirmLabel: 'Hapus',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await removeMutation.mutateAsync({ id: tax.id });
      ui.success.deleted(`Pajak "${tax.name}"`);
    } catch (e: unknown) {
      const msg = getErrorMessage(e);
      if (msg.includes('used') || msg.includes('digunakan')) {
        ui.error.inUse(`Pajak "${tax.name}"`);
      } else {
        toast.error(msg);
      }
    }
  };

  const handleToggleActive = async (tax: Tax) => {
    const willActivate = !tax.active;
    try {
      await updateMutation.mutateAsync({ id: tax.id, active: willActivate });
      if (willActivate) {
        ui.success.activated(`Pajak "${tax.name}"`);
      } else {
        ui.success.deactivated(`Pajak "${tax.name}"`);
      }
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Gagal mengubah status pajak.'));
    }
  };

  return (
    <div className="space-y-6">
      {confirmDialog}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pajak</h1>
          <p className="text-sm text-muted-foreground">
            Kelola tarif pajak untuk penjualan dan pembelian.
          </p>
        </div>
        <Button onClick={openCreate} disabled={submitting}>
          <Plus className="mr-1 h-4 w-4" /> Tambah Pajak
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Cari pajak..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Tarif</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Cakupan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Memuat data pajak...
                  </TableCell>
                </TableRow>
              ) : taxes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <FileWarning className="h-10 w-10 text-muted-foreground/50" />
                      <div>
                        <p className="font-medium text-foreground">
                          {search ? 'Tidak ada pajak yang cocok' : 'Belum ada pajak'}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {search
                            ? `Tidak ditemukan pajak dengan kata kunci "${search}".`
                            : 'Buat pajak pertama Anda untuk mulai menghitung pajak pada invoice.'}
                        </p>
                      </div>
                      {!search && (
                        <Button variant="outline" size="sm" onClick={openCreate}>
                          <Plus className="mr-1 h-4 w-4" /> Tambah Pajak
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                taxes.map((tax: Tax) => {
                  const sb = scopeBadge[tax.scope] ?? { label: tax.scope, variant: 'outline' as const };
                  return (
                    <TableRow key={tax.id}>
                      <TableCell className="font-medium">{tax.name}</TableCell>
                      <TableCell>
                        {tax.type === 'percentage' ? (
                          <>{(tax.rate * 100).toFixed(tax.rate * 100 % 1 === 0 ? 0 : 2)}%</>
                        ) : (
                          <>Rp {tax.rate.toLocaleString()}</>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="gap-1">
                          <Percent className="h-3 w-3" />
                          {tax.type === 'percentage' ? 'Persentase' : 'Nominal Tetap'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={sb.variant}>{sb.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => handleToggleActive(tax)}
                          className="cursor-pointer"
                          title={tax.active !== false ? 'Klik untuk menonaktifkan' : 'Klik untuk mengaktifkan'}
                        >
                          {tax.active !== false ? (
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                              Aktif
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              Nonaktif
                            </Badge>
                          )}
                        </button>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(tax)}>
                              <Edit className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(tax)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Hapus
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Pajak' : 'Tambah Pajak'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nama</label>
              <Input
                placeholder="contoh: PPN 11%"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Tarif</label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.type === 'percentage' ? form.rate * 100 : form.rate}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setForm({
                      ...form,
                      rate: form.type === 'percentage' ? val / 100 : val,
                    });
                  }}
                />
                {form.type === 'percentage' && (
                  <p className="text-xs text-muted-foreground mt-1">Masukkan persentase (contoh: 11 untuk 11%)</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">Tipe</label>
                <Select value={form.type} onValueChange={(v: TaxType) => setForm({ ...form, type: v, rate: 0 })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Persentase</SelectItem>
                    <SelectItem value="fixed">Nominal Tetap</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Cakupan</label>
              <Select value={form.scope} onValueChange={(v: TaxScope) => setForm({ ...form, scope: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Penjualan & Pembelian</SelectItem>
                  <SelectItem value="sales">Hanya Penjualan</SelectItem>
                  <SelectItem value="purchase">Hanya Pembelian</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Menyimpan...' : editing ? 'Perbarui' : 'Buat'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Need toast import for error fallback
import { toast } from 'sonner';
