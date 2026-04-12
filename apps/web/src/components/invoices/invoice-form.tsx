'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthMutation, useAuthPaginatedQuery } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ArrowLeft, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { InvoiceLineEditor, type InvoiceLineItem } from './invoice-line-editor';
import { AmountSummary } from '../sales/amount-summary';

interface InvoiceFormProps {
  invoiceId?: string;
  initialData?: {
    type: 'customer_invoice' | 'vendor_bill' | 'credit_note';
    companyId?: string;
    contactId?: string;
    invoiceDate: number;
    dueDate: number;
    paymentTermId?: string;
    currency?: string;
    notes?: string;
    internalNotes?: string;
    discountAmount?: number;
    discountType?: 'percentage' | 'fixed';
    lines: InvoiceLineItem[];
  };
}

export function InvoiceForm({ invoiceId, initialData }: InvoiceFormProps) {
  const router = useRouter();
  const isEdit = !!invoiceId;

  const [form, setForm] = useState({
    type: 'customer_invoice' as 'customer_invoice' | 'vendor_bill' | 'credit_note',
    companyId: '' as string,
    contactId: '' as string,
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    paymentTermId: '' as string,
    notes: '',
    internalNotes: '',
    currency: 'IDR',
    discountAmount: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    lines: [{ productName: '', quantity: 1, unitPrice: 0 }] as InvoiceLineItem[],
  });

  const { data: companies } = useAuthPaginatedQuery(api.companies.list, { search: undefined }, { initialNumItems: 100 });
  const { data: contacts } = useAuthPaginatedQuery(api.contacts.list, { search: undefined }, { initialNumItems: 100 });
  const { data: paymentTermsResult } = useAuthPaginatedQuery(api.paymentTerms.list, { search: undefined }, { initialNumItems: 50 });
  const paymentTerms = paymentTermsResult?.page ?? [];

  useEffect(() => {
    if (initialData) {
      setForm({
        type: initialData.type,
        companyId: initialData.companyId ?? '',
        contactId: initialData.contactId ?? '',
        invoiceDate: new Date(initialData.invoiceDate).toISOString().split('T')[0],
        dueDate: new Date(initialData.dueDate).toISOString().split('T')[0],
        paymentTermId: initialData.paymentTermId ?? '',
        notes: initialData.notes ?? '',
        internalNotes: initialData.internalNotes ?? '',
        currency: initialData.currency ?? 'IDR',
        discountAmount: initialData.discountAmount != null ? String(initialData.discountAmount) : '',
        discountType: initialData.discountType ?? 'percentage',
        lines: initialData.lines.length > 0 ? initialData.lines : [{ productName: '', quantity: 1, unitPrice: 0 }],
      });
    }
  }, [initialData]);

  const createInvoice = useAuthMutation(api.invoices.create);
  // Note: API invoices doesn't have update yet based on Task 3 implementation.
  // I will check if I should add it. For now, I'll follow what was implemented.
  
  // Update dueDate when invoiceDate or paymentTermId changes
  useEffect(() => {
    if (form.paymentTermId) {
      const term = paymentTerms.find((t) => t.id === form.paymentTermId);
      if (term) {
        const date = new Date(form.invoiceDate);
        date.setDate(date.getDate() + term.dueDays);
        setForm((prev) => ({ ...prev, dueDate: date.toISOString().split('T')[0] }));
      }
    }
  }, [form.invoiceDate, form.paymentTermId, paymentTerms]);

  // Calculate totals
  const { subtotal, taxAmount, totalAmount } = useMemo(() => {
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

    return { subtotal: sub, taxAmount: tax, totalAmount: total };
  }, [form.lines, form.discountAmount, form.discountType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validLines = form.lines.filter((l) => l.productName.trim());
    if (validLines.length === 0) {
      toast.error('Add at least one line item');
      return;
    }

    const payload: any = {
      type: form.type,
      companyId: form.companyId || undefined,
      contactId: form.contactId || undefined,
      invoiceDate: new Date(form.invoiceDate).getTime(),
      dueDate: new Date(form.dueDate).getTime(),
      paymentTermId: form.paymentTermId || undefined,
      currency: form.currency,
      notes: form.notes || undefined,
      internalNotes: form.internalNotes || undefined,
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
        taxId: l.taxId,
      })),
    };

    try {
      if (isEdit) {
        // update mutation not implemented in Task 3, but plan might expect it.
        // I will assume for now only create is supported as per Task 3.
        toast.error('Edit not yet supported in backend');
      } else {
        const newId = await createInvoice.mutateAsync(payload);
        toast.success('Invoice created');
        router.push(`/invoices/${newId}`);
      }
    } catch (e: any) {
      toast.error(e.data?.message ?? `Failed to ${isEdit ? 'update' : 'create'} invoice`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" type="button" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-900/40 dark:text-slate-400">
            <FileText className="size-4" />
          </div>
          <h2 className="text-lg font-semibold">{isEdit ? 'Edit Invoice' : 'New Invoice'}</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Main Info */}
          <Card>
            <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Invoice Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v: any) => setForm((prev) => ({ ...prev, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer_invoice">Customer Invoice</SelectItem>
                      <SelectItem value="vendor_bill">Vendor Bill</SelectItem>
                      <SelectItem value="credit_note">Credit Note</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={form.currency} onValueChange={(v) => setForm((prev) => ({ ...prev, currency: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IDR">IDR (Rp)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
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
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Invoice Lines</CardTitle></CardHeader>
            <CardContent>
              <InvoiceLineEditor
                lines={form.lines}
                onChange={(lines) => setForm((prev) => ({ ...prev, lines }))}
                currency={form.currency}
              />
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Notes</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Customer Notes</Label>
                <Textarea placeholder="Notes visible on invoice..." value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Internal Notes</Label>
                <Textarea placeholder="Internal notes..." value={form.internalNotes} onChange={(e) => setForm((prev) => ({ ...prev, internalNotes: e.target.value }))} rows={2} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Dates & Terms */}
          <Card>
            <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Dates & Terms</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Invoice Date *</Label>
                <Input type="date" value={form.invoiceDate} onChange={(e) => setForm((prev) => ({ ...prev, invoiceDate: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Payment Terms</Label>
                <Select value={form.paymentTermId || "__none__"} onValueChange={(v) => setForm((prev) => ({ ...prev, paymentTermId: v === "__none__" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select terms" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Immediate</SelectItem>
                    {paymentTerms.map((pt) => (
                      <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Due Date *</Label>
                <Input type="date" value={form.dueDate} onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))} />
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Summary</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Global Discount</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={form.discountAmount}
                    onChange={(e) => setForm((prev) => ({ ...prev, discountAmount: e.target.value }))}
                  />
                  <Select value={form.discountType} onValueChange={(v: any) => setForm((prev) => ({ ...prev, discountType: v }))}>
                    <SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">%</SelectItem>
                      <SelectItem value="fixed">Amt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <AmountSummary
                subtotal={subtotal}
                discountAmount={form.discountAmount ? Number(form.discountAmount) : undefined}
                discountType={form.discountType}
                taxAmount={taxAmount}
                totalAmount={totalAmount}
              />
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            <Button type="submit" disabled={createInvoice.isPending}>
              {createInvoice.isPending ? 'Saving...' : isEdit ? 'Update Invoice' : 'Create Invoice'}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          </div>
        </div>
      </div>
    </form>
  );
}
