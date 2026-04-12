'use client';

import { useState } from 'react';
import { useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Plus, Pencil, Archive, ArchiveRestore, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney, formatMoneyExtra } from '@/lib/format-money';

interface Variant {
  id: string;
  name: string;
  attributes?: Record<string, string> | null;
  priceExtra?: number | null;
  costExtra?: number | null;
  sku?: string | null;
  barcode?: string | null;
  weight?: number | null;
  active?: boolean | null;
}

interface VariantManagerProps {
  productId: string;
  variants: Variant[];
  basePrice?: number | null;
}

export function VariantManager({ productId, variants, basePrice }: VariantManagerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<Variant | null>(null);
  const [form, setForm] = useState({
    name: '',
    attributeKey: '',
    attributeValue: '',
    attributes: {} as Record<string, string>,
    priceExtra: '',
    costExtra: '',
    sku: '',
    barcode: '',
    weight: '',
  });

  const createVariant = useAuthMutation(api.productVariants.create);
  const updateVariant = useAuthMutation(api.productVariants.update);
  const archiveVariant = useAuthMutation(api.productVariants.archive);
  const unarchiveVariant = useAuthMutation(api.productVariants.unarchive);

  const resetForm = () => {
    setForm({
      name: '',
      attributeKey: '',
      attributeValue: '',
      attributes: {},
      priceExtra: '',
      costExtra: '',
      sku: '',
      barcode: '',
      weight: '',
    });
    setEditingVariant(null);
  };

  const openNewDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (variant: Variant) => {
    setEditingVariant(variant);
    setForm({
      name: variant.name,
      attributeKey: '',
      attributeValue: '',
      attributes: variant.attributes ?? {},
      priceExtra: variant.priceExtra != null ? String(variant.priceExtra) : '',
      costExtra: variant.costExtra != null ? String(variant.costExtra) : '',
      sku: variant.sku ?? '',
      barcode: variant.barcode ?? '',
      weight: variant.weight != null ? String(variant.weight) : '',
    });
    setDialogOpen(true);
  };

  const addAttribute = () => {
    const key = form.attributeKey.trim();
    const value = form.attributeValue.trim();
    if (key && value) {
      setForm((prev) => ({
        ...prev,
        attributes: { ...prev.attributes, [key]: value },
        attributeKey: '',
        attributeValue: '',
      }));
    }
  };

  const removeAttribute = (key: string) => {
    const { [key]: _, ...rest } = form.attributes;
    setForm((prev) => ({ ...prev, attributes: rest }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('Variant name is required');
      return;
    }

    const payload: any = {
      name: form.name.trim(),
      attributes: Object.keys(form.attributes).length > 0 ? form.attributes : undefined,
      priceExtra: form.priceExtra ? Number(form.priceExtra) : undefined,
      costExtra: form.costExtra ? Number(form.costExtra) : undefined,
      sku: form.sku || undefined,
      barcode: form.barcode || undefined,
      weight: form.weight ? Number(form.weight) : undefined,
    };

    try {
      if (editingVariant) {
        await updateVariant.mutateAsync({ id: editingVariant.id as any, ...payload });
        toast.success('Variant updated');
      } else {
        await createVariant.mutateAsync({ productId: productId as any, ...payload });
        toast.success('Variant created');
      }
      setDialogOpen(false);
      resetForm();
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to save variant');
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await archiveVariant.mutateAsync({ id: id as any });
      toast.success('Variant archived');
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to archive');
    }
  };

  const handleUnarchive = async (id: string) => {
    try {
      await unarchiveVariant.mutateAsync({ id: id as any });
      toast.success('Variant restored');
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to restore');
    }
  };

  const isPending = createVariant.isPending || updateVariant.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium uppercase tracking-wider">Variants ({variants.length})</h3>
        <Button size="sm" onClick={openNewDialog}>
          <Plus className="mr-1 h-4 w-4" />Add Variant
        </Button>
      </div>

      {variants.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <p className="text-sm">No variants yet. A default variant was created automatically.</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Variant</TableHead>
                <TableHead>Attributes</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Price Extra</TableHead>
                <TableHead>Total Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variants.map((variant) => {
                const totalPrice = (basePrice ?? 0) + (variant.priceExtra ?? 0);
                return (
                  <TableRow key={variant.id} className={!variant.active ? 'opacity-60' : ''}>
                    <TableCell className="font-medium">{variant.name}</TableCell>
                    <TableCell>
                      {variant.attributes && Object.keys(variant.attributes).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(variant.attributes).map(([k, v]) => (
                            <Badge key={k} variant="secondary" className="text-xs">
                              {k}: {v}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{variant.sku ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatMoneyExtra(variant.priceExtra)}
                    </TableCell>
                    <TableCell>
                      {formatMoney(totalPrice)}
                    </TableCell>
                    <TableCell>
                      {variant.active ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Active</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400">Archived</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(variant)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {variant.active ? (
                          <Button variant="ghost" size="sm" onClick={() => handleArchive(variant.id)}>
                            <Archive className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => handleUnarchive(variant.id)}>
                            <ArchiveRestore className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Variant Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingVariant ? 'Edit Variant' : 'Add Variant'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Variant Name *</label>
              <Input
                placeholder="e.g. Kaos Polos - Merah - L"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            {/* Attributes */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Attributes</label>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Key (e.g. Color)"
                  value={form.attributeKey}
                  onChange={(e) => setForm((prev) => ({ ...prev, attributeKey: e.target.value }))}
                  className="flex-1"
                />
                <Input
                  placeholder="Value (e.g. Red)"
                  value={form.attributeValue}
                  onChange={(e) => setForm((prev) => ({ ...prev, attributeValue: e.target.value }))}
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="sm" onClick={addAttribute}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {Object.keys(form.attributes).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {Object.entries(form.attributes).map(([k, v]) => (
                    <Badge key={k} variant="secondary" className="gap-1">
                      {k}: {v}
                      <button type="button" onClick={() => removeAttribute(k)}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Price & Cost extras */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Price Extra</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.priceExtra}
                  onChange={(e) => setForm((prev) => ({ ...prev, priceExtra: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Cost Extra</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.costExtra}
                  onChange={(e) => setForm((prev) => ({ ...prev, costExtra: e.target.value }))}
                />
              </div>
            </div>

            {/* SKU, Barcode, Weight */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">SKU</label>
                <Input
                  placeholder="SKU"
                  value={form.sku}
                  onChange={(e) => setForm((prev) => ({ ...prev, sku: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Barcode</label>
                <Input
                  placeholder="Barcode"
                  value={form.barcode}
                  onChange={(e) => setForm((prev) => ({ ...prev, barcode: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Weight (kg)</label>
                <Input
                  type="number"
                  placeholder="0"
                  step="0.01"
                  value={form.weight}
                  onChange={(e) => setForm((prev) => ({ ...prev, weight: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? 'Saving...' : editingVariant ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
