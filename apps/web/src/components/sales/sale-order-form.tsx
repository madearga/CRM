'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
import { ArrowLeft, ShoppingCart, Bookmark, Save } from 'lucide-react';
import { toast } from 'sonner';
import { LineItemEditor, type LineItem } from './line-item-editor';
import { AmountSummary } from './amount-summary';
import { useAuthQuery } from '@/lib/convex/hooks';

interface CompanyOption { id: string; name: string }
interface ContactOption { id: string; fullName: string }

function dateToTimestamp(dateStr: string): number {
  if (!dateStr) return 0;
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d, 12, 0, 0);
}

function timestampToDate(ts: number): string {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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
  const isDirty = useRef(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  // Template list for selector
  const { data: templates } = useAuthPaginatedQuery(api.quotationTemplates.list, {
    search: undefined,
    includeArchived: false,
  }, { initialNumItems: 100 });

  // Template detail for auto-fill
  const { data: templateDetail } = useAuthQuery(
    api.quotationTemplates.getById,
    selectedTemplateId ? { id: selectedTemplateId as any } : 'skip',
  );

  // Save as template mutation
  const saveAsTemplate = useAuthMutation(api.quotationTemplates.createFromSaleOrder);

  const markDirty = () => { isDirty.current = true; };
  const updateHeader = (fn: (prev: typeof header) => typeof header) => {
    markDirty();
    setHeader(fn);
  };
  const updateLines = (newLines: LineItem[]) => {
    markDirty();
    setLines(newLines);
  };

  const [header, setHeader] = useState({
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
  });
  const [lines, setLines] = useState<LineItem[]>([{ productName: '', quantity: 1, unitPrice: 0 }]);

  const { data: companies } = useAuthPaginatedQuery(api.companies.list, { search: undefined }, { initialNumItems: 100 });
  const { data: contacts } = useAuthPaginatedQuery(api.contacts.list, { search: undefined }, { initialNumItems: 100 });

  // Pricelist resolution for selected company
  const { data: companyDetail } = useAuthQuery(
    api.companies.getById,
    header.companyId ? { id: header.companyId as any } : 'skip',
  );
  const pricelistId = companyDetail?.pricelistId;
  const pricelistName = companyDetail?.pricelistName;

  // Resolve prices for line items when company changes
  const { data: resolvedPrices } = useAuthQuery(
    api.pricelists.resolvePrices,
    header.companyId && lines.some(l => l.productId)
      ? {
          productIds: lines.filter(l => l.productId).map(l => l.productId as any),
          companyId: header.companyId as any,
          quantities: lines.filter(l => l.productId).map(l => l.quantity),
        }
      : 'skip',
  );

  // Auto-apply resolved prices
  useEffect(() => {
    if (!resolvedPrices || resolvedPrices.length === 0) return;
    const updated = [...lines];
    let changed = false;
    for (const resolved of resolvedPrices) {
      const idx = updated.findIndex(l => l.productId === resolved.productId);
      if (idx >= 0 && updated[idx].unitPrice !== resolved.finalPrice) {
        updated[idx] = { ...updated[idx], unitPrice: resolved.finalPrice };
        changed = true;
      }
    }
    if (changed) setLines(updated);
  }, [resolvedPrices]);

  useEffect(() => {
    if (initialData) {
      setHeader({
        companyId: initialData.companyId ?? '',
        contactId: initialData.contactId ?? '',
        orderDate: timestampToDate(initialData.orderDate),
        validUntil: initialData.validUntil ? timestampToDate(initialData.validUntil) : '',
        deliveryDate: initialData.deliveryDate ? timestampToDate(initialData.deliveryDate) : '',
        deliveryAddress: initialData.deliveryAddress ?? '',
        internalNotes: initialData.internalNotes ?? '',
        customerNotes: initialData.customerNotes ?? '',
        terms: initialData.terms ?? '',
        discountAmount: initialData.discountAmount != null ? String(initialData.discountAmount) : '',
        discountType: initialData.discountType ?? 'percentage',
      });
      setLines(initialData.lines.length > 0 ? initialData.lines : [{ productName: '', quantity: 1, unitPrice: 0 }]);
    }
  }, [initialData]);

  // Auto-fill from template when template detail loads
  useEffect(() => {
    if (templateDetail && !initialData) {
      isDirty.current = true;
      setHeader((prev) => ({
        ...prev,
        internalNotes: templateDetail.internalNotes ?? prev.internalNotes,
        customerNotes: templateDetail.customerNotes ?? prev.customerNotes,
        terms: templateDetail.terms ?? prev.terms,
        discountAmount: templateDetail.discountAmount != null ? String(templateDetail.discountAmount) : prev.discountAmount,
        discountType: templateDetail.discountType ?? prev.discountType,
      }));
      setLines(
        templateDetail.lines.length > 0
          ? templateDetail.lines.map((l) => ({
              productName: l.productName,
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              discount: l.discount,
              discountType: l.discountType,
              taxAmount: l.taxAmount,
              productId: l.productId,
              productVariantId: undefined,
            }))
          : [{ productName: '', quantity: 1, unitPrice: 0 }],
      );
    }
  }, [templateDetail, initialData]);

  const createSO = useAuthMutation(api.saleOrders.create);
  const updateSO = useAuthMutation(api.saleOrders.update);

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

  // Calculate totals
  const { subtotal, discountValue, taxAmount, totalAmount } = useMemo(() => {
    const sub = lines.reduce((sum, l) => {
      let lineTotal = l.quantity * l.unitPrice;
      if (l.discount) {
        if (l.discountType === 'percentage') lineTotal -= lineTotal * (l.discount / 100);
        else lineTotal -= l.discount;
      }
      // Tax summed separately below — don't include in subtotal
      return sum + lineTotal;
    }, 0);

    const disc = header.discountAmount
      ? header.discountType === 'percentage'
        ? sub * Number(header.discountAmount) / 100
        : Number(header.discountAmount)
      : 0;

    const tax = lines.reduce((sum, l) => sum + (l.taxAmount ?? 0), 0);
    const total = Math.round((sub - disc + tax) * 100) / 100;

    return { subtotal: sub, discountValue: disc, taxAmount: tax, totalAmount: total };
  }, [lines, header.discountAmount, header.discountType]);

  const handleSaveAsTemplate = async () => {
    if (!saleOrderId) {
      toast.error('Save order first, then save as template');
      return;
    }
    const name = saveTemplateName.trim();
    if (!name) {
      toast.error('Enter a template name');
      return;
    }
    try {
      await saveAsTemplate.mutateAsync({ saleOrderId: saleOrderId as any, name, description: `From SO ${name}` });
      toast.success('Template created from sale order');
      setShowSaveTemplate(false);
      setSaveTemplateName('');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to create template');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validLines = lines.filter((l) => l.productName.trim());

    const errors: string[] = [];
    if (!header.orderDate) errors.push('Order date is required');
    if (validLines.length === 0) errors.push('Add at least one line item');
    if (validLines.some((l) => !l.quantity || l.quantity <= 0)) errors.push('All line items must have quantity > 0');
    if (validLines.some((l) => l.unitPrice < 0)) errors.push('All line items must have a valid price');

    if (errors.length > 0) {
      toast.error(errors.join('. '));
      return;
    }

    const payload = {
      companyId: header.companyId || undefined,
      contactId: header.contactId || undefined,
      orderDate: dateToTimestamp(header.orderDate),
      validUntil: header.validUntil ? dateToTimestamp(header.validUntil) : undefined,
      deliveryDate: header.deliveryDate ? dateToTimestamp(header.deliveryDate) : undefined,
      deliveryAddress: header.deliveryAddress || undefined,
      internalNotes: header.internalNotes || undefined,
      customerNotes: header.customerNotes || undefined,
      terms: header.terms || undefined,
      discountAmount: header.discountAmount ? Number(header.discountAmount) : undefined,
      discountType: header.discountAmount ? header.discountType : undefined,
      lines: validLines.map((l) => ({
        productName: l.productName.trim(),
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discount: l.discount,
        discountType: l.discountType,
        taxAmount: l.taxAmount,
        productId: l.productId as any,
        productVariantId: l.productVariantId as any,
      })),
    } as any;

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
          lines: payload.lines,
        });
        toast.success('Sale order updated');
        router.push(`/sales/${saleOrderId}`);
      } else {
        const newId = await createSO.mutateAsync(payload);
        toast.success('Sale order created');
        router.push(`/sales/${newId}`);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : `Failed to ${isEdit ? 'update' : 'create'} sale order`;
      toast.error(message);
    }
  };

  const isPending = createSO.isPending || updateSO.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" type="button" onClick={handleCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
            <ShoppingCart className="size-4" />
          </div>
          <h2 className="text-lg font-semibold">{isEdit ? 'Edit Sale Order' : 'New Quotation'}</h2>
        </div>
      </div>

      {/* Template Selector */}
      {!isEdit && (
        <Card>
          <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Load from Template</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Bookmark className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedTemplateId || '__none__'} onValueChange={(v) => setSelectedTemplateId(v === '__none__' ? '' : v)}>
                <SelectTrigger className="w-[300px]"><SelectValue placeholder="Select a template..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No template</SelectItem>
                  {(templates ?? []).map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}{t.isDefault ? ' (default)' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Customer & Dates */}
      <Card>
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Customer & Dates</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Company</Label>
              <Select value={header.companyId || "__none__"} onValueChange={(v) => updateHeader((prev) => ({ ...prev, companyId: v === "__none__" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No company</SelectItem>
                  {(companies ?? []).map((c: CompanyOption) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {pricelistId && (
                <p className="text-xs text-muted-foreground mt-1">
                  Price from pricelist: <span className="font-medium text-foreground">{pricelistName ?? 'Unknown'}</span>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Contact</Label>
              <Select value={header.contactId || "__none__"} onValueChange={(v) => updateHeader((prev) => ({ ...prev, contactId: v === "__none__" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select contact" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No contact</SelectItem>
                  {(contacts ?? []).map((c: ContactOption) => (
                    <SelectItem key={c.id} value={c.id}>{c.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Order Date *</Label>
              <Input type="date" value={header.orderDate} onChange={(e) => updateHeader((prev) => ({ ...prev, orderDate: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Valid Until</Label>
              <Input type="date" value={header.validUntil} onChange={(e) => updateHeader((prev) => ({ ...prev, validUntil: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Delivery Date</Label>
              <Input type="date" value={header.deliveryDate} onChange={(e) => updateHeader((prev) => ({ ...prev, deliveryDate: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Delivery Address</Label>
            <Input placeholder="Delivery address..." value={header.deliveryAddress} onChange={(e) => updateHeader((prev) => ({ ...prev, deliveryAddress: e.target.value }))} />
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Order Lines</CardTitle></CardHeader>
        <CardContent>
          <LineItemEditor
            lines={lines}
            onChange={updateLines}
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
        <AmountSummary
          subtotal={subtotal}
          discountAmount={header.discountAmount ? Number(header.discountAmount) : undefined}
          discountType={header.discountType as any}
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
          {isPending ? 'Saving...' : isEdit ? 'Update Order' : 'Create Quotation'}
        </Button>
        <Button type="button" variant="outline" onClick={handleCancel}>Cancel</Button>
        {isEdit && (
          <>
            {showSaveTemplate ? (
              <div className="flex items-center gap-2 ml-auto">
                <Input
                  placeholder="Template name..."
                  value={saveTemplateName}
                  onChange={(e) => setSaveTemplateName(e.target.value)}
                  className="w-48"
                />
                <Button type="button" variant="outline" size="sm" onClick={handleSaveAsTemplate} disabled={saveAsTemplate.isPending}>
                  <Save className="mr-1 h-4 w-4" />Save
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowSaveTemplate(false)}>Cancel</Button>
              </div>
            ) : (
              <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={() => setShowSaveTemplate(true)}>
                <Bookmark className="mr-1 h-4 w-4" />Save as Template
              </Button>
            )}
          </>
        )}
      </div>
    </form>
  );
}
