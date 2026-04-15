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
import { Plus, MoreHorizontal, Edit, Trash2, Search, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';

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
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    dueDays: 30,
    discountDays: 0,
    discountPercent: 0,
  });

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
      toast.error('Name is required');
      return;
    }
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
        toast.success('Payment term updated');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Payment term created');
      }
      setDialogOpen(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as any)?.data?.message ?? 'Failed';
      toast.error(msg);
    }
  };

  const handleDelete = async (id: Id<'paymentTerms'>) => {
    if (!confirm('Delete this payment term?')) return;
    try {
      await removeMutation.mutateAsync({ id });
      toast.success('Payment term deleted');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as any)?.data?.message ?? 'Failed';
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payment Terms</h1>
          <p className="text-sm text-muted-foreground">
            Manage payment due dates and early payment discounts.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" /> New Payment Term
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search payment terms..."
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
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-center">Due Days</TableHead>
                <TableHead className="text-center">Early Pay Discount</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : terms.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No payment terms found. Create one to get started.
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
                        <span className="font-medium text-green-600">Immediate</span>
                      ) : (
                        <span>Net {pt.dueDays}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {pt.discountDays && pt.discountPercent ? (
                        <span className="text-sm">
                          {pt.discountPercent}% off if paid within {pt.discountDays} days
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
                            onClick={() => handleDelete(pt.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
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
            <DialogTitle>{editing ? 'Edit Payment Term' : 'New Payment Term'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                placeholder="e.g. Net 30"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input
                placeholder="Payment due within 30 days"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Due Days</label>
              <Input
                type="number"
                min={0}
                value={form.dueDays}
                onChange={(e) => setForm({ ...form, dueDays: parseInt(e.target.value) || 0 })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {form.dueDays === 0 ? 'Payment due immediately' : `Payment due within ${form.dueDays} days`}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Discount Days</label>
                <Input
                  type="number"
                  min={0}
                  value={form.discountDays}
                  onChange={(e) => setForm({ ...form, discountDays: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Discount %</label>
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
                {form.discountPercent}% discount if paid within {form.discountDays} days
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>{editing ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
