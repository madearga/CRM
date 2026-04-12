'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ArrowLeft, FileText, Plus, Trash2 } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { formatMoney } from '@/lib/format-money';

export interface TemplateLineItem {
  id?: string;
  productName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  discountType?: 'percentage' | 'fixed';
  taxAmount?: number;
  productId?: string;
}

interface TemplateFormProps {
  templateId?: string;
  initialData?: {
    name: string;
    description?: string;
    discountAmount?: number;
    discountType?: 'percentage' | 'fixed';
    internalNotes?: string;
    customerNotes?: string;
    terms?: string;
    currency?: string;
    validForDays?: number;
    isDefault?: boolean;
    lines: TemplateLineItem[];
  };
}

function calculateSubtotal(line: TemplateLineItem): number {
  let subtotal = line.quantity * line.unitPrice;
  if (line.discount) {
    if (line.discountType === 'percentage') {
      subtotal -= subtotal * (line.discount / 100);
    } else {
      subtotal -= line.discount;
    }
  }
  return Math.round(subtotal * 100) / 100;
}

export function TemplateForm({ templateId, initialData }: TemplateFormProps) {
  const router = useRouter();
  const isEdit = !!templateId;
  const isDirty = useRef(false);

  const markDirty = () => { isDirty.current = true; };
  const updateHeader = (fn: (prev: typeof header) => typeof header) => {
    markDirty();
    setHeader(fn);
  };
  const updateLines = (newLines: TemplateLineItem[]) => {
    markDirty();
    setLines(newLines);
  };

  const [header, setHeader] = useState({
    name: '',
    description: '',
    discountAmount: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    internalNotes: '',
    customerNotes: '',
    terms: '',
    currency: '',
    validForDays: '30',
    isDefault: false,
  });
  const [lines, setLines] = useState<TemplateLineItem[]>([{ productName: '', quantity: 1, unitPrice: 0 }]);

  useEffect(() => {
    if (initialData) {
      setHeader({
        name: initialData.name ?? '',
        description: initialData.description ?? '',
        discountAmount: initialData.discountAmount != null ? String(initialData.discountAmount) : '',
        discountType: initialData.discountType ?? 'percentage',
        internalNotes: initialData.internalNotes ?? '',
        customerNotes: initialData.customerNotes ?? '',
        terms: initialData.terms ?? '',
        currency: initialData.currency ?? '',
        validForDays: initialData.validForDays != null ? String(initialData.validForDays) : '30',
        isDefault: initialData.isDefault ?? false,
      });
      setLines(initialData.lines.length > 0 ? initialData.lines : [{ productName: '', quantity: 1, unitPrice: 0 }]);
    }
  }, [initialData]);

  const createTmpl = useAuthMutation(api.quotationTemplates.create);
  const updateTmpl = useAuthMutation(api.quotationTemplates.update);

  // Unsaved changes guard
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const handleCancel = () => {
    if (isDirty.current && !confirm('You have unsaved changes. Discard?')) return;
    router.back();
  };

  const addLine = () => {
    updateLines([...lines, { productName: '', quantity: 1, unitPrice: 0 }]);
  };

  const removeLine = (index: number) => {
    updateLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof TemplateLineItem, value: any) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };
    updateLines(updated);
  };

  const { subtotal, taxAmount } = useMemo(() => {
    const sub = lines.reduce((sum, l) => sum + calculateSubtotal(l), 0);
    const tax = lines.reduce((sum, l) => sum + (l.taxAmount ?? 0), 0);
    return { subtotal: sub, taxAmount: tax };
  }, [lines]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validLines = lines.filter((l) => l.productName.trim());

    const errors: string[] = [];
    if (!header.name.trim()) errors.push('Name is required');
    if (validLines.length === 0) errors.push('Add at least one line item');
    if (validLines.some((l) => !l.quantity || l.quantity <= 0)) errors.push('All line items must have quantity > 0');

    if (errors.length > 0) {
      toast.error(errors.join('. '));
      return;
    }

    const payload = {
      name: header.name.trim(),
      description: header.description || undefined,
      discountAmount: header.discountAmount ? Number(header.discountAmount) : undefined,
      discountType: header.discountAmount ? header.discountType : undefined,
      internalNotes: header.internalNotes || undefined,
      customerNotes: header.customerNotes || undefined,
      terms: header.terms || undefined,
      currency: header.currency || undefined,
      validForDays: header.validForDays ? Number(header.validForDays) : undefined,
      isDefault: header.isDefault || undefined,
      lines: validLines.map((l) => ({
        productName: l.productName.trim(),
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discount: l.discount,
        discountType: l.discountType,
        taxAmount: l.taxAmount,
        productId: l.productId as any,
      })),
    } as any;

    try {
      if (isEdit) {
        await updateTmpl.mutateAsync({ id: templateId as any, ...payload });
        toast.success('Template updated');
        router.push('/templates');
      } else {
        await createTmpl.mutateAsync(payload);
        toast.success('Template created');
        router.push('/templates');
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : `Failed to ${isEdit ? 'update' : 'create'} template`;
      toast.error(message);
    }
  };

  const isPending = createTmpl.isPending || updateTmpl.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" type="button" onClick={handleCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400">
            <FileText className="size-4" />
          </div>
          <h2 className="text-lg font-semibold">{isEdit ? 'Edit Template' : 'New Template'}</h2>
        </div>
      </div>

      {/* Details */}
      <Card>
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Template Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input placeholder="Template name..." value={header.name} onChange={(e) => updateHeader((prev) => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input placeholder="Brief description..." value={header.description} onChange={(e) => updateHeader((prev) => ({ ...prev, description: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={header.currency || '__none__'} onValueChange={(v) => updateHeader((prev) => ({ ...prev, currency: v === '__none__' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Default" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Default</SelectItem>
                  <SelectItem value="IDR">IDR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valid For (days)</Label>
              <Input type="number" min="1" value={header.validForDays} onChange={(e) => updateHeader((prev) => ({ ...prev, validForDays: e.target.value }))} />
            </div>
            <div className="flex items-end gap-2">
              <Label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={header.isDefault}
                  onChange={(e) => updateHeader((prev) => ({ ...prev, isDefault: e.target.checked }))}
                  className="rounded"
                />
                Default template
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Line Items</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Product</TableHead>
                  <TableHead className="w-[80px]">Qty</TableHead>
                  <TableHead className="w-[120px]">Unit Price</TableHead>
                  <TableHead className="w-[100px]">Discount</TableHead>
                  <TableHead className="w-[80px]">Tax</TableHead>
                  <TableHead className="w-[120px] text-right">Subtotal</TableHead>
                  <TableHead className="w-[40px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, i) => {
                  const lineSubtotal = calculateSubtotal(line);
                  return (
                    <TableRow key={i}>
                      <TableCell>
                        <Input
                          placeholder="Product name"
                          value={line.productName}
                          onChange={(e) => updateLine(i, 'productName', e.target.value)}
                        />
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
                        <Input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={line.discount ?? ''}
                          onChange={(e) => updateLine(i, 'discount', e.target.value ? Number(e.target.value) : undefined)}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={line.taxAmount ?? ''}
                          onChange={(e) => updateLine(i, 'taxAmount', e.target.value ? Number(e.target.value) : undefined)}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatMoney(lineSubtotal)}
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
          <Button variant="outline" size="sm" onClick={addLine} className="mt-3">
            <Plus className="mr-1 h-4 w-4" />Add Line
          </Button>
        </CardContent>
      </Card>

      {/* Discount */}
      <Card>
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Global Discount</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min="0"
              placeholder="0"
              value={header.discountAmount}
              onChange={(e) => updateHeader((prev) => ({ ...prev, discountAmount: e.target.value }))}
              className="w-32"
            />
            <Select value={header.discountType} onValueChange={(v: 'percentage' | 'fixed') => updateHeader((prev) => ({ ...prev, discountType: v }))}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Percentage (%)</SelectItem>
                <SelectItem value="fixed">Fixed Amount</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Notes & Terms</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Customer Notes</Label>
            <Textarea placeholder="Notes visible to customer..." value={header.customerNotes} onChange={(e) => updateHeader((prev) => ({ ...prev, customerNotes: e.target.value }))} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Internal Notes</Label>
            <Textarea placeholder="Internal notes..." value={header.internalNotes} onChange={(e) => updateHeader((prev) => ({ ...prev, internalNotes: e.target.value }))} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Terms & Conditions</Label>
            <Textarea placeholder="Payment terms, delivery terms..." value={header.terms} onChange={(e) => updateHeader((prev) => ({ ...prev, terms: e.target.value }))} rows={2} />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving...' : isEdit ? 'Update Template' : 'Create Template'}
        </Button>
        <Button type="button" variant="outline" onClick={handleCancel}>Cancel</Button>
      </div>
    </form>
  );
}
