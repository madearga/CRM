'use client';

import { useState } from 'react';
import { useAuthPaginatedQuery, useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Plus, MoreHorizontal, Edit, Trash2, Search, CalendarDays, FileWarning } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { ui, getErrorMessage } from '@/lib/ui-messages';

type PaymentTerm = {
  id: Id<'paymentTerms'>;
  name: string;
  description?: string;
  dueDays: number;
  discountDays?: number;
  discountPercent?: number;
};

export default function PaymentTermsPage() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<PaymentTerm | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    dueDays: 30,
    discountDays: 0,
    discountPercent: 0,
  });

  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const { data, isLoading } = useAuthPaginatedQuery(
    api.paymentTerms.list,
    { search: search || undefined },
    { initialNumItems: 100 },
  );

  const createMutation = useAuthMutation(api.paymentTerms.create);
  const updateMutation = useAuthMutation(api.paymentTerms.update);
  const removeMutation = useAuthMutation(api.paymentTerms.remove);

  const terms = data ?? [];

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', dueDays: 30, discountDays: 0, discountPercent: 0 });
    setDialogOpen(true);
  };

  const openEdit = (pt: PaymentTerm) => {
    setEditing(pt);
    setForm({
      name: pt.name,
      description: pt.description ?? '',
      dueDays: pt.dueDays,
      discountDays: pt.discountDays ?? 0,
      discountPercent: pt.discountPercent ?? 0,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      ui.error.validation('Nama termin wajib diisi.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        dueDays: form.dueDays,
        discountDays: form.discountDays || undefined,
        discountPercent: form.discountPercent || undefined,
      };
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, ...payload });
        ui.success.updated(`Termin "${form.name}"`);
      } else {
        await createMutation.mutateAsync(payload);
        ui.success.created(`Termin "${form.name}"`);
      }
      setDialogOpen(false);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Gagal menyimpan termin pembayaran.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (pt: PaymentTerm) => {
    const ok = await confirm({
      title: 'Hapus Termin Pembayaran',
      description: `Termin "${pt.name}" akan dihapus secara permanen. Invoice yang sudah menggunakan termin ini tidak akan terpengaruh.`,
      confirmLabel: 'Hapus',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await removeMutation.mutateAsync({ id: pt.id });
      ui.success.deleted(`Termin "${pt.name}"`);
    } catch (e: unknown) {
      const msg = getErrorMessage(e);
      if (msg.includes('used') || msg.includes('digunakan')) {
        ui.error.inUse(`Termin "${pt.name}"`);
      } else {
        toast.error(msg);
      }
    }
  };

  return (
    <div className="space-y-6">
      {confirmDialog}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Termin Pembayaran</h1>
          <p className="text-sm text-muted-foreground">
            Kelola jatuh tempo dan diskon bayar cepat.
          </p>
        </div>
        <Button onClick={openCreate} disabled={submitting}>
          <Plus className="mr-1 h-4 w-4" /> Tambah Termin
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Cari termin pembayaran..."
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
                <TableHead>Deskripsi</TableHead>
                <TableHead className="text-center">Jatuh Tempo</TableHead>
                <TableHead className="text-center">Diskon Bayar Cepat</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Memuat data termin...
                  </TableCell>
                </TableRow>
              ) : terms.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <FileWarning className="h-10 w-10 text-muted-foreground/50" />
                      <div>
                        <p className="font-medium text-foreground">
                          {search ? 'Tidak ada termin yang cocok' : 'Belum ada termin pembayaran'}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {search
                            ? `Tidak ditemukan termin dengan kata kunci "${search}".`
                            : 'Buat termin seperti "Net 30" untuk mengatur jatuh tempo invoice.'}
                        </p>
                      </div>
                      {!search && (
                        <Button variant="outline" size="sm" onClick={openCreate}>
                          <Plus className="mr-1 h-4 w-4" /> Tambah Termin
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                terms.map((pt: PaymentTerm) => (
                  <TableRow key={pt.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                        {pt.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {pt.description || '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      {pt.dueDays === 0 ? (
                        <span className="font-medium text-green-600">Langsung Bayar</span>
                      ) : (
                        <span>Net {pt.dueDays}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {pt.discountDays && pt.discountPercent ? (
                        <span className="text-sm">
                          Diskon {pt.discountPercent}% jika dibayar dalam {pt.discountDays} hari
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(pt)}>
                            <Edit className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(pt)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Hapus
                          </DropdownMenuItem>
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Termin' : 'Tambah Termin'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nama</label>
              <Input
                placeholder="contoh: Net 30"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Deskripsi</label>
              <Input
                placeholder="Pembayaran dalam 30 hari"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Jatuh Tempo (hari)</label>
              <Input
                type="number"
                min={0}
                value={form.dueDays}
                onChange={(e) => setForm({ ...form, dueDays: parseInt(e.target.value) || 0 })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {form.dueDays === 0 ? 'Pembayaran langsung' : `Pembayaran dalam ${form.dueDays} hari`}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Diskon (hari)</label>
                <Input
                  type="number"
                  min={0}
                  value={form.discountDays}
                  onChange={(e) => setForm({ ...form, discountDays: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Diskon (%)</label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.discountPercent}
                  onChange={(e) => setForm({ ...form, discountPercent: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
            </div>
            {form.discountDays > 0 && form.discountPercent > 0 && (
              <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                💡 Diskon {form.discountPercent}% jika dibayar dalam {form.discountDays} hari pertama
              </p>
            )}
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
