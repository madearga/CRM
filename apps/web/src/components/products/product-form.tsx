'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthMutation, useAuthQuery } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Package, X } from 'lucide-react';
import { toast } from 'sonner';

const UNITS = ['pcs', 'kg', 'g', 'm', 'cm', 'hour', 'day', 'liter', 'box', 'pack', 'unit', 'set'];

interface ProductFormProps {
  /** If provided, we're in edit mode. */
  productId?: string;
  /** Initial data for edit mode. */
  initialData?: {
    name: string;
    type: string;
    description?: string;
    category?: string;
    imageUrl?: string;
    cost?: number;
    price?: number;
    unit?: string;
    sku?: string;
    barcode?: string;
    weight?: number;
    tags?: string[];
    notes?: string;
  };
}

export function ProductForm({ productId, initialData }: ProductFormProps) {
  const router = useRouter();
  const isEdit = !!productId;

  const [form, setForm] = useState({
    name: '',
    type: 'storable' as string,
    description: '',
    category: '',
    imageUrl: '',
    cost: '' as string,
    price: '' as string,
    unit: '',
    sku: '',
    barcode: '',
    weight: '' as string,
    notes: '',
    tagInput: '',
    tags: [] as string[],
  });

  // Load categories for dropdown
  const { data: categories } = useAuthQuery(api.productCategories.list, {});

  // Load initial data for edit mode
  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name,
        type: initialData.type,
        description: initialData.description ?? '',
        category: initialData.category ?? '',
        imageUrl: initialData.imageUrl ?? '',
        cost: initialData.cost != null ? String(initialData.cost) : '',
        price: initialData.price != null ? String(initialData.price) : '',
        unit: initialData.unit ?? '',
        sku: initialData.sku ?? '',
        barcode: initialData.barcode ?? '',
        weight: initialData.weight != null ? String(initialData.weight) : '',
        notes: initialData.notes ?? '',
        tagInput: '',
        tags: initialData.tags ?? [],
      });
    }
  }, [initialData]);

  const createProduct = useAuthMutation(api.products.create);
  const updateProduct = useAuthMutation(api.products.update);

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addTag = () => {
    const tag = form.tagInput.trim();
    if (tag && !form.tags.includes(tag)) {
      setForm((prev) => ({ ...prev, tags: [...prev.tags, tag], tagInput: '' }));
    }
  };

  const removeTag = (tag: string) => {
    setForm((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = form.name.trim();
    if (!trimmed) {
      toast.error('Product name is required');
      return;
    }

    const payload: any = {
      name: trimmed,
      type: form.type,
      description: form.description || undefined,
      category: form.category || undefined,
      imageUrl: form.imageUrl || undefined,
      cost: form.cost ? Number(form.cost) : undefined,
      price: form.price ? Number(form.price) : undefined,
      unit: form.unit || undefined,
      sku: form.sku || undefined,
      barcode: form.barcode || undefined,
      weight: form.weight ? Number(form.weight) : undefined,
      notes: form.notes || undefined,
      tags: form.tags.length > 0 ? form.tags : undefined,
    };

    try {
      if (isEdit) {
        await updateProduct.mutateAsync({ id: productId as any, ...payload });
        toast.success('Product updated');
        router.push(`/products/${productId}`);
      } else {
        const newId = await createProduct.mutateAsync(payload);
        toast.success('Product created');
        router.push(`/products/${newId}`);
      }
    } catch (e: any) {
      toast.error(e.data?.message ?? `Failed to ${isEdit ? 'update' : 'create'} product`);
    }
  };

  const isPending = createProduct.isPending || updateProduct.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" type="button" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
            <Package className="size-4" />
          </div>
          <h2 className="text-lg font-semibold">{isEdit ? 'Edit Product' : 'New Product'}</h2>
        </div>
      </div>

      {/* General Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wider">General Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                placeholder="e.g. Kaos Polos"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Product Type *</Label>
              <Select value={form.type} onValueChange={(v) => update('type', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="storable">Storable (Physical Goods)</SelectItem>
                  <SelectItem value="consumable">Consumable</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Product description..."
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              {/* NOTE: Uses category name as value (string field on products schema).
                  TODO: Consider using categoryId for proper referential integrity. */}
              <Select value={form.category || "__none__"} onValueChange={(v) => update('category', v === "__none__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No category</SelectItem>
                  {(categories ?? []).map((cat: any) => (
                    <SelectItem key={cat.id} value={cat.name}>
                      {cat.parentId ? `  ↳ ${cat.name}` : cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unit of Measure</Label>
              <Select value={form.unit || "__none__"} onValueChange={(v) => update('unit', v === "__none__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No unit</SelectItem>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wider">Pricing</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Sale Price</Label>
              <Input
                id="price"
                type="number"
                placeholder="0"
                value={form.price}
                onChange={(e) => update('price', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost">Cost Price</Label>
              <Input
                id="cost"
                type="number"
                placeholder="0"
                value={form.cost}
                onChange={(e) => update('cost', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wider">Inventory & Identification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                placeholder="e.g. KAOS-001"
                value={form.sku}
                onChange={(e) => update('sku', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="barcode">Barcode</Label>
              <Input
                id="barcode"
                placeholder="EAN/UPC"
                value={form.barcode}
                onChange={(e) => update('barcode', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weight">Weight (kg)</Label>
              <Input
                id="weight"
                type="number"
                placeholder="0"
                step="0.01"
                value={form.weight}
                onChange={(e) => update('weight', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tags */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wider">Tags</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Add a tag..."
              value={form.tagInput}
              onChange={(e) => update('tagInput', e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag();
                }
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={addTag}>
              Add
            </Button>
          </div>
          {form.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {form.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wider">Internal Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Internal notes about this product..."
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving...' : isEdit ? 'Update Product' : 'Create Product'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
