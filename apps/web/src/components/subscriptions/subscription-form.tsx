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
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { InvoiceLineEditor, type InvoiceLineItem } from '@/components/invoices/invoice-line-editor';

interface SubscriptionFormProps {
  subscriptionId?: string;
  initialData?: {
    name: string;
    description?: string;
    interval: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    intervalCount?: number;
    billingDay: number;
    startDate: number;
    endDate?: number;
    autoGenerateInvoice?: boolean;
    autoPostInvoice?: boolean;
    numberOfInvoices?: number;
    currency?: string;
    notes?: string;
    discountAmount?: number;
    discountType?: 'percentage' | 'fixed';
    paymentTermId?: string;
    companyId?: string;
    contactId?: string;
    lines: InvoiceLineItem[];
  };
}

function calculateSubtotal(line: InvoiceLineItem): number {
  let subtotal = line.quantity * line.unitPrice;
  if (line.discount) {
    if (line.discountType === 'percentage') subtotal -= subtotal * (line.discount / 100);
    else subtotal -= line.discount;
  }
  if (line.taxAmount) subtotal += line.taxAmount;
  return Math.round(subtotal * 100) / 100;
}

export function SubscriptionForm({ subscriptionId, initialData }: SubscriptionFormProps) {
  const router = useRouter();
  const isEdit = !!subscriptionId;

  const [form, setForm] = useState({
    name: '',
    description: '',
    interval: 'monthly' as 'weekly' | 'monthly' | 'quarterly' | 'yearly',
    intervalCount: '1',
    billingDay: '1',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    autoGenerateInvoice: true,
    autoPostInvoice: false,
    numberOfInvoices: '',
    currency: 'IDR',
    notes: '',
    discountAmount: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    paymentTermId: '',
    companyId: '',
    contactId: '',
    lines: [{ productName: '', quantity: 1, unitPrice: 0 }] as InvoiceLineItem[],
  });

  const { data: companies } = useAuthPaginatedQuery(api.companies.list, { search: undefined }, { initialNumItems: 100 });
  const { data: contacts } = useAuthPaginatedQuery(api.contacts.list, { search: undefined }, { initialNumItems: 100 });
  const { data: paymentTerms = [] } = useAuthPaginatedQuery(api.paymentTerms.list, { search: undefined } as any, { initialNumItems: 50 });

  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name,
        description: initialData.description ?? '',
        interval: initialData.interval,
        intervalCount: String(initialData.intervalCount ?? 1),
        billingDay: String(initialData.billingDay),
        startDate: new Date(initialData.startDate).toISOString().split('T')[0],
        endDate: initialData.endDate ? new Date(initialData.endDate).toISOString().split('T')[0] : '',
        autoGenerateInvoice: initialData.autoGenerateInvoice ?? true,
        autoPostInvoice: initialData.autoPostInvoice ?? false,
        numberOfInvoices: initialData.numberOfInvoices != null ? String(initialData.numberOfInvoices) : '',
        currency: initialData.currency ?? 'IDR',
        notes: initialData.notes ?? '',
        discountAmount: initialData.discountAmount != null ? String(initialData.discountAmount) : '',
        discountType: initialData.discountType ?? 'percentage',
        paymentTermId: initialData.paymentTermId ?? '',
        companyId: initialData.companyId ?? '',
        contactId: initialData.contactId ?? '',
        lines: initialData.lines.length > 0 ? initialData.lines : [{ productName: '', quantity: 1, unitPrice: 0 }],
      });
    }
  }, [initialData]);

  const createSub = useAuthMutation(api.subscriptions.create);
  const updateSub = useAuthMutation(api.subscriptions.update);

  // Calculate totals
  const { subtotal, totalAmount } = useMemo(() => {
    const sub = form.lines.reduce((sum, l) => sum + calculateSubtotal(l), 0);
    const disc = form.discountAmount
      ? form.discountType === 'percentage'
        ? sub * Number(form.discountAmount) / 100
        : Number(form.discountAmount)
      : 0;
    const total = Math.round((sub - disc) * 100) / 100;
    return { subtotal: sub, totalAmount: total };
  }, [form.lines, form.discountAmount, form.discountType]);

  // Preview next 3 billing dates
  const upcomingDates = useMemo(() => {
    const dates: Date[] = [];
    const start = new Date(form.startDate);
    const intervalCount = parseInt(form.intervalCount) || 1;
    const billingDay = parseInt(form.billingDay) || 1;

    let current = new Date(start.getFullYear(), start.getMonth(), billingDay);
    if (current.getTime() < start.getTime()) {
      // Move to next period
      current.setMonth(current.getMonth() + intervalCount);
    }

    for (let i = 0; i < 3; i++) {
      dates.push(new Date(current));
      switch (form.interval) {
        case 'weekly':
          current.setDate(current.getDate() + 7 * intervalCount);
          break;
        case 'monthly':
          current.setMonth(current.getMonth() + intervalCount);
          break;
        case 'quarterly':
          current.setMonth(current.getMonth() + 3 * intervalCount);
          break;
        case 'yearly':
          current.setFullYear(current.getFullYear() + intervalCount);
          break;
      }
    }
    return dates;
  }, [form.startDate, form.interval, form.intervalCount, form.billingDay]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validLines = form.lines.filter((l) => l.productName.trim());
    if (validLines.length === 0) {
      toast.error('Add at least one line item');
      return;
    }

    const payload: any = {
      name: form.name.trim(),
      description: form.description || undefined,
      interval: form.interval,
      intervalCount: parseInt(form.intervalCount) || undefined,
      billingDay: parseInt(form.billingDay),
      startDate: new Date(form.startDate).getTime(),
      endDate: form.endDate ? new Date(form.endDate).getTime() : undefined,
      autoGenerateInvoice: form.autoGenerateInvoice,
      autoPostInvoice: form.autoPostInvoice,
      numberOfInvoices: form.numberOfInvoices ? parseInt(form.numberOfInvoices) : undefined,
      currency: form.currency,
      notes: form.notes || undefined,
      discountAmount: form.discountAmount ? Number(form.discountAmount) : undefined,
      discountType: form.discountAmount ? form.discountType : undefined,
      paymentTermId: form.paymentTermId || undefined,
      companyId: form.companyId || undefined,
      contactId: form.contactId || undefined,
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
        await updateSub.mutateAsync({ id: subscriptionId as any, ...payload });
        toast.success('Subscription updated');
        router.push(`/subscriptions/${subscriptionId}`);
      } else {
        const newId = await createSub.mutateAsync(payload);
        toast.success('Subscription created');
        router.push(`/subscriptions/${newId}`);
      }
    } catch (e: any) {
      toast.error(e.data?.message ?? `Failed to ${isEdit ? 'update' : 'create'} subscription`);
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
            <RefreshCw className="size-4" />
          </div>
          <h2 className="text-lg font-semibold">{isEdit ? 'Edit Subscription' : 'New Subscription'}</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Main Info */}
          <Card>
            <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Subscription Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  placeholder="e.g. Monthly Hosting, Annual License"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="Optional description..."
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer (Company)</Label>
                  <Select value={form.companyId || "__none__"} onValueChange={(v) => setForm((prev) => ({ ...prev, companyId: v === "__none__" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
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
                      <SelectItem value="__none__">None</SelectItem>
                      {(contacts ?? []).map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Billing Config */}
          <Card>
            <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Billing Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Interval</Label>
                  <Select value={form.interval} onValueChange={(v: any) => setForm((prev) => ({ ...prev, interval: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Every N intervals</Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.intervalCount}
                    onChange={(e) => setForm((prev) => ({ ...prev, intervalCount: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Billing Day (1-28)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="28"
                    value={form.billingDay}
                    onChange={(e) => setForm((prev) => ({ ...prev, billingDay: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date (optional)</Label>
                  <Input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={form.autoGenerateInvoice}
                    onCheckedChange={(v) => setForm((prev) => ({ ...prev, autoGenerateInvoice: v }))}
                  />
                  <Label>Auto-generate invoices</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={form.autoPostInvoice}
                    onCheckedChange={(v) => setForm((prev) => ({ ...prev, autoPostInvoice: v }))}
                  />
                  <Label>Auto-post invoices</Label>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Number of invoices limit (optional, blank = unlimited)</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="e.g. 12"
                  value={form.numberOfInvoices}
                  onChange={(e) => setForm((prev) => ({ ...prev, numberOfInvoices: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Line Items</CardTitle></CardHeader>
            <CardContent>
              <InvoiceLineEditor
                lines={form.lines}
                onChange={(lines) => setForm((prev) => ({ ...prev, lines }))}
                currency={form.currency}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Settings */}
          <Card>
            <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={form.currency} onValueChange={(v) => setForm((prev) => ({ ...prev, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IDR">IDR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Payment Terms</Label>
                <Select value={form.paymentTermId || "__none__"} onValueChange={(v) => setForm((prev) => ({ ...prev, paymentTermId: v === "__none__" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select payment terms" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {paymentTerms.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>{t.name} ({t.dueDays} days)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Discount</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={form.discountAmount}
                    onChange={(e) => setForm((prev) => ({ ...prev, discountAmount: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Discount Type</Label>
                  <Select value={form.discountType} onValueChange={(v: any) => setForm((prev) => ({ ...prev, discountType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed">Fixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Internal notes..."
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Upcoming Billing Dates</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {upcomingDates.map((date, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <div className="size-2 rounded-full bg-emerald-500" />
                  <span>{date.toLocaleDateString('id-ID', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Totals */}
          <Card>
            <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Summary</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatMoney(subtotal, form.currency)}</span>
              </div>
              {form.discountAmount && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span>-{form.discountType === 'percentage' ? `${form.discountAmount}%` : formatMoney(Number(form.discountAmount), form.currency)}</span>
                </div>
              )}
              <div className="flex justify-between font-medium border-t pt-2">
                <span>Total per invoice</span>
                <span>{formatMoney(totalAmount, form.currency)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={createSub.isPending || updateSub.isPending}>
              {isEdit ? 'Update Subscription' : 'Create Subscription'}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

function formatMoney(amount: number, currency: string = "IDR"): string {
  if (currency === "IDR") return `Rp ${amount.toLocaleString("id-ID")}`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}
