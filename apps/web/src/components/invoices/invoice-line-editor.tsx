'use client';

import { useState } from 'react';
import { useAuthPaginatedQuery } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';
import { formatMoney } from '@/lib/format-money';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

export interface InvoiceLineItem {
  id?: string;
  productName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  discountType?: 'percentage' | 'fixed';
  taxAmount?: number;
  productId?: string;
  taxId?: string;
}

interface InvoiceLineEditorProps {
  lines: InvoiceLineItem[];
  onChange: (lines: InvoiceLineItem[]) => void;
  currency?: string;
}

export function InvoiceLineEditor({ lines, onChange, currency = "IDR" }: InvoiceLineEditorProps) {
  const [productSearch, setProductSearch] = useState('');
  const [showProductSearch, setShowProductSearch] = useState<number | null>(null);

  const { data: products } = useAuthPaginatedQuery(api.products.list, {
    search: productSearch || undefined,
  }, { initialNumItems: 20 });

  const { data: taxesResult } = useAuthPaginatedQuery(api.taxes.list, {
    scope: 'sales',
  }, { initialNumItems: 50 });
  const taxes = taxesResult?.page ?? [];

  const addLine = () => {
    onChange([...lines, { productName: '', quantity: 1, unitPrice: 0 }]);
  };

  const removeLine = (index: number) => {
    onChange(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof InvoiceLineItem, value: any) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-calculate taxAmount if taxId changed
    if (field === 'taxId') {
      const tax = taxes.find((t) => t.id === value);
      if (tax) {
        const line = updated[index];
        let base = line.quantity * line.unitPrice;
        if (line.discount) {
          if (line.discountType === 'percentage') base -= base * (line.discount / 100);
          else base -= line.discount;
        }
        const taxAmount = tax.type === 'percentage' ? base * tax.rate : tax.rate;
        updated[index].taxAmount = Math.round(taxAmount * 100) / 100;
      } else {
        updated[index].taxAmount = undefined;
      }
    }

    onChange(updated);
  };

  const selectProduct = (lineIndex: number, product: any) => {
    const updated = [...lines];
    updated[lineIndex] = {
      ...updated[lineIndex],
      productName: product.name,
      unitPrice: product.price ?? 0,
      productId: product.id,
    };
    onChange(updated);
    setShowProductSearch(null);
    setProductSearch('');
  };

  return (
    <div className="space-y-3">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">Product</TableHead>
              <TableHead className="w-[80px]">Qty</TableHead>
              <TableHead className="w-[120px]">Unit Price</TableHead>
              <TableHead className="w-[120px]">Tax</TableHead>
              <TableHead className="w-[120px] text-right">Subtotal</TableHead>
              <TableHead className="w-[40px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line, i) => {
              const subtotal = calculateSubtotal(line);
              return (
                <TableRow key={i}>
                  <TableCell className="relative">
                    <Input
                      placeholder="Product name"
                      value={line.productName}
                      onChange={(e) => updateLine(i, 'productName', e.target.value)}
                      onFocus={() => setShowProductSearch(i)}
                    />
                    {showProductSearch === i && (products?.length ?? 0) > 0 && (
                      <div className="absolute left-0 top-full z-50 mt-1 w-80 rounded-md border bg-popover shadow-lg">
                        <div className="p-2">
                          <Input
                            placeholder="Search products..."
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            autoFocus
                          />
                        </div>
                        <div className="max-h-48 overflow-auto">
                          {(products ?? []).map((p: any) => (
                            <button
                              key={p.id}
                              className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent"
                              onClick={() => selectProduct(i, p)}
                            >
                              <span>{p.name}</span>
                              <span className="text-muted-foreground">{formatMoney(p.price, currency)}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={line.quantity}
                      onChange={(e) => updateLine(i, 'quantity', Number(e.target.value))}
                      className="w-20"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      value={line.unitPrice}
                      onChange={(e) => updateLine(i, 'unitPrice', Number(e.target.value))}
                      className="w-28"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={line.taxId || "none"}
                      onValueChange={(v) => updateLine(i, 'taxId', v === "none" ? undefined : v)}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="No Tax" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Tax</SelectItem>
                        {taxes.map((tax) => (
                          <SelectItem key={tax.id} value={tax.id}>
                            {tax.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatMoney(subtotal, currency)}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => removeLine(i)} disabled={lines.length <= 1}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <Button variant="outline" size="sm" onClick={addLine}>
        <Plus className="mr-1 h-4 w-4" />Add Line
      </Button>
    </div>
  );
}

function calculateSubtotal(line: InvoiceLineItem): number {
  let subtotal = line.quantity * line.unitPrice;
  if (line.discount) {
    if (line.discountType === 'percentage') {
      subtotal -= subtotal * (line.discount / 100);
    } else {
      subtotal -= line.discount;
    }
  }
  if (line.taxAmount) subtotal += line.taxAmount;
  return Math.round(subtotal * 100) / 100;
}
