'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthMutation, useAuthQuery, useAuthPaginatedQuery } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { LineItemEditor, type LineItem } from './line-item-editor';
import { AmountSummary } from './amount-summary';
import { formatMoney } from '@/lib/format-money';

interface SaleOrderFormProps {
  saleOrderId?: string;
  initialData?: {
    companyId?: string;
    contactId?: string;
    orderDate: number;
    validUntil?: number;
    deliveryDate?: number;
    deliveryAddress?: string;
    internalNotes?: string;
    customerNotes?: string;
    terms?: string;
    currency?: string;
    discountAmount?: number;
    discountType?: 'percentage' | 'fixed';
    lines: LineItem[];
  };
}

export function SaleOrderForm({ saleOrderId, initialData }: SaleOrderFormProps) {
  const router = useRouter();
  const isEdit = !!saleOrderId;

  const [form, setForm] = useState({
    companyId: '' as string,
    contactId: '' as string,
    orderDate: new Date().toISOString().split('T')[0],
    validUntil: '',
    deliveryDate: '',
    deliveryAddress: '',
    internalNotes: '',
    customerNotes: '',
    terms: '',
    discountAmount: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    lines: [{ productName: '', quantity: 1, unitPrice: 0 }] as LineItem[],
  });

  const { data: companies } = useAuthPaginatedQuery(api.companies.list, { search: undefined }, { initialNumItems: 100 });
  const { data: contacts } = useAuthPaginatedQuery(api.contacts.list, { search: undefined }, { initialNumItems: 100 });

  useEffect(() => {
    if (initialData) {
      setForm({
        companyId: initialData.companyId ?? '',
        contactId: initialData.contactId ?? '',
        orderDate: new Date(initialData.orderDate).toISOString().split('T')[0],
        validUntil: initialData.validUntil ? new Date(initialData.validUntil).toISOString().split('T')[0] : '',
        deliveryDate: initialData.deliveryDate ? new Date(initialData.deliveryDate).toISOString().split('T')[0] : '',
        deliveryAddress: initialData.deliveryAddress ?? '',
        internalNotes: initialData.internalNotes ?? '',
        customerNotes: initialData.customerNotes ?? '',
        terms: initialData.terms ?? '',
        discountAmount: initialData.discountAmount != null ? String(initialData.discountAmount) : '',
        discountType: initialData.discountType ?? 'percentage',
        lines: initialData.lines.length > 0 ? initialData.lines : [{ productName: '', quantity: 1, unitPrice: 0 }],
      });
    }
  }, [initialData]);

  const createSO = useAuthMutation(api.saleOrders.create);
  const updateSO = useAuthMutation(api.saleOrders.update);

  // Calculate totals
  const { subtotal, discountValue, taxAmount, totalAmount } = useMemo(() => {
    const sub = form.lines.reduce((sum, l) => {
      let lineTotal = l.quantity * l.unitPrice;
      if (l.discount) {
        if (l.discountType === 'percentage') lineTotal -= lineTotal * (l.discount / 100);
        else lineTotal -= l.discount;
      }
      if (l.taxAmount) lineTotal += l.taxAmount;
      return sum + lineTotal;
    }, 0);

    const disc = form.discountAmount
      ? form.discountType === 'percentage'
        ? sub * Number(form.discountAmount) / 100
        : Number(form.discountAmount)
      : 0;

    const tax = form.lines.reduce((sum, l) => sum + (l.taxAmount ?? 0), 0);
    const total = Math.round((sub - disc + tax) * 100) / 100;

    return { subtotal: sub, discountValue: disc, taxAmount: tax, totalAmount: total };
  }, [form.lines, form.discountAmount, form.discountType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validLines = form.lines.filter((l) => l.productName.trim());
    if (validLines.length === 0) {
      toast.error('Add at least one line item');
      return;
    }

    const payload: any = {
      companyId: form.companyId || undefined,
      contactId: form.contactId || undefined,
      orderDate: new Date(form.orderDate).getTime(),
      validUntil: form.validUntil ? new Date(form.validUntil).getTime() : undefined,
      deliveryDate: form.deliveryDate ? new Date(form.deliveryDate).getTime() : undefined,
      deliveryAddress: form.deliveryAddress || undefined,
      internalNotes: form.internalNotes || undefined,
      customerNotes: form.customerNotes || undefined,
      terms: form.terms || undefined,
      discountAmount: form.discountAmount ? Number(form.discountAmount) : undefined,
      discountType: form.discountAmount ? form.discountType : undefined,
      lines: validLines.map((l) => ({
        productName: l.productName.trim(),
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discount: l.discount,
        discountType: l.discountType,
        taxAmount: l.taxAmount,
        productId: l.productId,
        productVariantId: l.productVariantId,
      })),
    };

    try {
      if (isEdit) {
        await updateSO.mutateAsync({
          id: saleOrderId as any,
          companyId: payload.companyId,
          contactId: payload.contactId,
          orderDate: payload.orderDate,
          validUntil: payload.validUntil,
          deliveryDate: payload.deliveryDate,
          deliveryAddress: payload.deliveryAddress,
          internalNotes: payload.internalNotes,
          customerNotes: payload.customerNotes,
          terms: payload.terms,
          discountAmount: payload.discountAmount,
          discountType: payload.discountType,
        });
        toast.success('Sale order updated');
        router.push(`/sales/${saleOrderId}`);
      } else {
        const newId = await createSO.mutateAsync(payload);
        toast.success('Sale order created');
        router.push(`/sales/${newId}`);
      }
    } catch (e: any) {
      toast.error(e.data?.message ?? `Failed to ${isEdit ? 'update' : 'create'} sale order`);
    }
  };

  const isPending = createSO.isPending || updateSO.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" type="button" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
            <ShoppingCart className="size-4" />
          </div>
          <h2 className="text-lg font-semibold">{isEdit ? 'Edit Sale Order' : 'New Quotation'}</h2>
        </div>
      </div>

      {/* Customer & Dates */}
      <Card>
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Customer & Dates</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Company</Label>
              <Select value={form.companyId || "__none__"} onValueChange={(v) => setForm((prev) => ({ ...prev, companyId: v === "__none__" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No company</SelectItem>
                  {(companies ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Contact</Label>
              <Select value={form.contactId || "__none__"} onValueChange={(v) => setForm((prev) => ({ ...prev, contactId: v === "__none__" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select contact" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No contact</SelectItem>
                  {(contacts ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Order Date *</Label>
              <Input type="date" value={form.orderDate} onChange={(e) => setForm((prev) => ({ ...prev, orderDate: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Valid Until</Label>
              <Input type="date" value={form.validUntil} onChange={(e) => setForm((prev) => ({ ...prev, validUntil: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Delivery Date</Label>
              <Input type="date" value={form.deliveryDate} onChange={(e) => setForm((prev) => ({ ...prev, deliveryDate: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Delivery Address</Label>
            <Input placeholder="Delivery address..." value={form.deliveryAddress} onChange={(e) => setForm((prev) => ({ ...prev, deliveryAddress: e.target.value }))} />
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Order Lines</CardTitle></CardHeader>
        <CardContent>
          <LineItemEditor
            lines={form.lines}
            onChange={(lines) => setForm((prev) => ({ ...prev, lines }))}
          />
        </CardContent>
      </Card>

      {/* Discount & Summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Global Discount</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={form.discountAmount}
                onChange={(e) => setForm((prev) => ({ ...prev, discountAmount: e.target.value }))}
                className="w-32"
              />
              <Select value={form.discountType} onValueChange={(v: any) => setForm((prev) => ({ ...prev, discountType: v }))}>
                <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="fixed">Fixed Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
        <AmountSummary
          subtotal={subtotal}
          discountAmount={form.discountAmount ? Number(form.discountAmount) : undefined}
          discountType={form.discountType as any}
          taxAmount={taxAmount}
          totalAmount={totalAmount}
        />
      </div>

      {/* Notes */}
      <Card>
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Notes & Terms</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Customer Notes</Label>
            <Textarea placeholder="Notes visible to customer..." value={form.customerNotes} onChange={(e) => setForm((prev) => ({ ...prev, customerNotes: e.target.value }))} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Internal Notes</Label>
            <Textarea placeholder="Internal notes..." value={form.internalNotes} onChange={(e) => setForm((prev) => ({ ...prev, internalNotes: e.target.value }))} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Terms & Conditions</Label>
            <Textarea placeholder="Payment terms, delivery terms..." value={form.terms} onChange={(e) => setForm((prev) => ({ ...prev, terms: e.target.value }))} rows={2} />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving...' : isEdit ? 'Update Order' : 'Create Quotation'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
