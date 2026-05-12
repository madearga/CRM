'use client';

import { useAuthQuery, useAuthPaginatedQuery } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { X } from 'lucide-react';

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

interface PriceRuleRowProps {
  rule: RuleForm;
  pricelistType: 'fixed' | 'percentage_discount' | 'formula';
  onChange: (field: keyof RuleForm, value: any) => void;
  onRemove: () => void;
}

function tsToDate(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toISOString().split('T')[0];
}

function dateToTs(dateStr: string): number | undefined {
  if (!dateStr) return undefined;
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d, 12, 0, 0);
}

export function PriceRuleRow({ rule, pricelistType, onChange, onRemove }: PriceRuleRowProps) {
  const { data: productsData } = useAuthPaginatedQuery(api.products.list, {}, { initialNumItems: 100 });
  const { data: categories } = useAuthQuery(api.productCategories.list, {});

  const products = productsData ?? [];

  return (
    <div className="grid grid-cols-[1fr_1fr_80px_120px_120px_120px_40px] gap-2 items-end rounded-md border p-3">
      {/* Product */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Product</label>
        <Select
          value={rule.productId || '__all__'}
          onValueChange={(v) => onChange('productId', v === '__all__' ? undefined : v)}
        >
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="All products" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All products</SelectItem>
            {products.map((p: any) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Category */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Category</label>
        <Select
          value={rule.productCategoryId || '__all__'}
          onValueChange={(v) => onChange('productCategoryId', v === '__all__' ? undefined : v)}
        >
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="All categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All categories</SelectItem>
            {(categories ?? []).map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Min Quantity */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Min Qty</label>
        <Input
          type="number"
          min="0"
          placeholder="0"
          className="h-8 text-sm"
          value={rule.minQuantity ?? ''}
          onChange={(e) => onChange('minQuantity', e.target.value ? Number(e.target.value) : undefined)}
        />
      </div>

      {/* Price / Discount / Formula */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">
          {pricelistType === 'fixed' ? 'Fixed Price' : pricelistType === 'percentage_discount' ? 'Discount %' : 'Formula'}
        </label>
        {pricelistType === 'fixed' ? (
          <Input
            type="number"
            min="0"
            placeholder="0"
            className="h-8 text-sm"
            value={rule.fixedPrice ?? ''}
            onChange={(e) => onChange('fixedPrice', e.target.value ? Number(e.target.value) : undefined)}
          />
        ) : pricelistType === 'percentage_discount' ? (
          <Input
            type="number"
            min="0"
            max="100"
            placeholder="0"
            className="h-8 text-sm"
            value={rule.discountPercent ?? ''}
            onChange={(e) => onChange('discountPercent', e.target.value ? Number(e.target.value) : undefined)}
          />
        ) : (
          <Input
            placeholder="base * 0.9"
            className="h-8 text-sm"
            value={rule.formula ?? ''}
            onChange={(e) => onChange('formula', e.target.value || undefined)}
          />
        )}
      </div>

      {/* Start Date */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Start</label>
        <Input
          type="date"
          className="h-8 text-sm"
          value={tsToDate(rule.startDate)}
          onChange={(e) => onChange('startDate', dateToTs(e.target.value))}
        />
      </div>

      {/* End Date */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">End</label>
        <Input
          type="date"
          className="h-8 text-sm"
          value={tsToDate(rule.endDate)}
          onChange={(e) => onChange('endDate', dateToTs(e.target.value))}
        />
      </div>

      {/* Remove */}
      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onRemove}>
        <X className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}
