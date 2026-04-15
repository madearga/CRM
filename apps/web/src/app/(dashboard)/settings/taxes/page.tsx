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
import { Plus, MoreHorizontal, Edit, Trash2, Search, Percent } from 'lucide-react';
import { toast } from 'sonner';

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
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    name: '',
    rate: 0,
    type: 'percentage' as 'percentage' | 'fixed',
    scope: 'both' as 'sales' | 'purchase' | 'both',
    active: true,
  });

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
      toast.error('Name is required');
      return;
    }
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, ...form });
        toast.success('Tax updated');
      } else {
        await createMutation.mutateAsync(form);
        toast.success('Tax created');
      }
      setDialogOpen(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as any)?.data?.message ?? 'Failed';
      toast.error(msg);
    }
  };

  const handleDelete = async (id: Id<'taxes'>) => {
    if (!confirm('Delete this tax?')) return;
    try {
      await removeMutation.mutateAsync({ id });
      toast.success('Tax deleted');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as any)?.data?.message ?? 'Failed';
      toast.error(msg);
    }
  };

  const handleToggleActive = async (tax: Tax) => {
    try {
      await updateMutation.mutateAsync({ id: tax.id, active: !tax.active });
      toast.success(tax.active ? 'Tax deactivated' : 'Tax activated');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as any)?.data?.message ?? 'Failed';
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Taxes</h1>
          <p className="text-sm text-muted-foreground">
            Manage tax rates for sales and purchases.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" /> New Tax
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search taxes..."
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
                <TableHead>Rate</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : taxes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No taxes found. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                taxes.map((tax: Tax) => {
                  const sb = scopeBadge[tax.scope] ?? { label: tax.scope, variant: 'outline' as const };
                  return (
                    <TableRow key={tax.id}>
                      <TableCell className="font-medium">{tax.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {tax.type === 'percentage' ? (
                            <>{(tax.rate * 100).toFixed(tax.rate * 100 % 1 === 0 ? 0 : 2)}%</>
                          ) : (
                            <>Rp {tax.rate.toLocaleString()}</>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="gap-1">
                          <Percent className="h-3 w-3" />
                          {tax.type === 'percentage' ? 'Percentage' : 'Fixed'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={sb.variant}>{sb.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => handleToggleActive(tax)}
                          className="cursor-pointer"
                        >
                          {tax.active !== false ? (
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              Inactive
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
                              onClick={() => handleDelete(tax.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
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
            <DialogTitle>{editing ? 'Edit Tax' : 'New Tax'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                placeholder="e.g. PPN 11%"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Rate</label>
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
                  <p className="text-xs text-muted-foreground mt-1">Enter percentage (e.g. 11 for 11%)</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">Type</label>
                <Select value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v, rate: 0 })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Scope</label>
              <Select value={form.scope} onValueChange={(v: any) => setForm({ ...form, scope: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Both (Sales & Purchase)</SelectItem>
                  <SelectItem value="sales">Sales Only</SelectItem>
                  <SelectItem value="purchase">Purchase Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
