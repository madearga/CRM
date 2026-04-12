'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthMutation, useAuthPaginatedQuery, useAuthQuery } from '@/lib/convex/hooks';
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
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import { PriceRuleRow } from './price-rule-row';

interface RuleForm {
  id?: string;
  productId?: string;
  productCategoryId?: string;
  minQuantity?: number;
  fixedPrice?: number;
  discountPercent?: number;
  formula?: string;
  startDate?: number;
  endDate?: number;
}

interface PricelistFormProps {
  pricelistId?: string;
}

export function PricelistForm({ pricelistId }: PricelistFormProps) {
  const router = useRouter();
  const isEdit = !!pricelistId;

  const [form, setForm] = useState({
    name: '',
    description: '',
    type: 'percentage_discount' as 'fixed' | 'percentage_discount' | 'formula',
    defaultDiscount: '',
    currency: 'IDR',
    priority: '',
    isActive: true,
  });
  const [rules, setRules] = useState<RuleForm[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Fetch pricelist detail for editing
  const { data: detail } = useAuthQuery(
    api.pricelists.getById,
    pricelistId ? { id: pricelistId as any } : 'skip',
  );

  useEffect(() => {
    if (detail && !loaded) {
      setForm({
        name: detail.name,
        description: detail.description ?? '',
        type: detail.type,
        defaultDiscount: detail.defaultDiscount != null ? String(detail.defaultDiscount) : '',
        currency: detail.currency ?? 'IDR',
        priority: detail.priority != null ? String(detail.priority) : '',
        isActive: detail.isActive ?? true,
      });
      setRules(
        detail.rules.map((r: any) => ({
          id: r.id,
          productId: r.productId,
          productCategoryId: r.productCategoryId,
          minQuantity: r.minQuantity,
          fixedPrice: r.fixedPrice,
          discountPercent: r.discountPercent,
          formula: r.formula,
          startDate: r.startDate,
          endDate: r.endDate,
        }))
      );
      setLoaded(true);
    }
  }, [detail, loaded]);

  const createPL = useAuthMutation(api.pricelists.create);
  const updatePL = useAuthMutation(api.pricelists.update);

  const addRule = () => {
    setRules([...rules, {}]);
  };

  const removeRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const updateRule = (index: number, field: keyof RuleForm, value: any) => {
    const updated = [...rules];
    updated[index] = { ...updated[index], [field]: value };
    setRules(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }

    const payload: any = {
      name: form.name.trim(),
      type: form.type,
      description: form.description || undefined,
      defaultDiscount: form.defaultDiscount ? Number(form.defaultDiscount) : undefined,
      currency: form.currency,
      priority: form.priority ? Number(form.priority) : undefined,
      isActive: form.isActive,
      rules: rules.map((r) => ({
        productId: r.productId || undefined,
        productCategoryId: r.productCategoryId || undefined,
        minQuantity: r.minQuantity,
        fixedPrice: r.fixedPrice,
        discountPercent: r.discountPercent,
        formula: r.formula,
        startDate: r.startDate,
        endDate: r.endDate,
      })),
    };

    try {
      if (isEdit) {
        await updatePL.mutateAsync({ id: pricelistId as any, ...payload });
        toast.success('Pricelist updated');
      } else {
        const newId = await createPL.mutateAsync(payload);
        toast.success('Pricelist created');
        router.push(`/settings/pricelists/${newId}`);
        return;
      }
    } catch (e: any) {
      toast.error(e.data?.message ?? `Failed to ${isEdit ? 'update' : 'create'} pricelist`);
    }
  };

  const isPending = createPL.isPending || updatePL.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" type="button" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold">{isEdit ? 'Edit Pricelist' : 'New Pricelist'}</h2>
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                placeholder="e.g. Retail Default, Wholesale"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed Price</SelectItem>
                  <SelectItem value="percentage_discount">Percentage Discount</SelectItem>
                  <SelectItem value="formula">Formula</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="Describe this pricelist..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Default Discount %</Label>
              <Input
                type="number"
                min="0"
                max="100"
                placeholder="0"
                value={form.defaultDiscount}
                onChange={(e) => setForm({ ...form, defaultDiscount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="IDR">IDR (Rp)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Input
                type="number"
                placeholder="0"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Higher = wins when multiple match</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rules */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm uppercase tracking-wider">Pricing Rules</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addRule}>
            + Add Rule
          </Button>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No rules yet. The default discount will apply to all products.
            </p>
          ) : (
            <div className="space-y-3">
              {rules.map((rule, i) => (
                <PriceRuleRow
                  key={i}
                  rule={rule}
                  pricelistType={form.type}
                  onChange={(field, value) => updateRule(i, field, value)}
                  onRemove={() => removeRule(i)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Companies (show only in edit mode) */}
      {isEdit && detail?.companies && detail.companies.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Assigned Companies</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {detail.companies.map((c: any) => (
                <Badge key={c.id} variant="secondary">{c.name}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          <Save className="mr-1 h-4 w-4" />
          {isPending ? 'Saving...' : isEdit ? 'Update Pricelist' : 'Create Pricelist'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
