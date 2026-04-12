'use client';

import { useAuthQuery, useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft, ShoppingCart, Copy, Archive, RotateCcw, Pencil,
  Send, CheckCircle, FileText, Truck, CheckCheck, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useParams, useRouter } from 'next/navigation';
import { formatMoney } from '@/lib/format-money';

const STATE_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  confirmed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  invoiced: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  delivered: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  cancel: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const WORKFLOW_ACTIONS: Record<string, { target: string; label: string; icon: any; variant: 'default' | 'outline' | 'destructive' }[]> = {
  draft: [{ target: 'sent', label: 'Send', icon: Send, variant: 'default' }, { target: 'cancel', label: 'Cancel', icon: XCircle, variant: 'destructive' }],
  sent: [{ target: 'confirmed', label: 'Confirm', icon: CheckCircle, variant: 'default' }, { target: 'cancel', label: 'Cancel', icon: XCircle, variant: 'destructive' }],
  confirmed: [{ target: 'invoiced', label: 'Create Invoice', icon: FileText, variant: 'default' }, { target: 'delivered', label: 'Mark Delivered', icon: Truck, variant: 'outline' }, { target: 'cancel', label: 'Cancel', icon: XCircle, variant: 'destructive' }],
  invoiced: [{ target: 'done', label: 'Mark Done', icon: CheckCheck, variant: 'default' }],
  delivered: [{ target: 'done', label: 'Mark Done', icon: CheckCheck, variant: 'default' }],
  done: [],
  cancel: [],
};

export default function SaleOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: so, isLoading } = useAuthQuery(api.saleOrders.getById, { id: id as any });
  const transitionState = useAuthMutation(api.saleOrders.transitionState);
  const archiveSO = useAuthMutation(api.saleOrders.archive);
  const unarchiveSO = useAuthMutation(api.saleOrders.unarchive);
  const duplicateSO = useAuthMutation(api.saleOrders.duplicate);

  const createInvoice = useAuthMutation(api.invoices.createFromSaleOrder);

  const handleCreateInvoice = async () => {
    try {
      const invId = await createInvoice.mutateAsync({ saleOrderId: id as any });
      toast.success('Invoice created');
      router.push(`/invoices/${invId}`);
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to create invoice');
    }
  };

  const handleTransition = async (target: string) => {
    if (target === 'invoiced') {
      await handleCreateInvoice();
      return;
    }
    try {
      await transitionState.mutateAsync({ id: id as any, targetState: target as any });
      toast.success(`Order ${target}`);
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed');
    }
  };

  const handleArchive = async () => {
    try {
      await archiveSO.mutateAsync({ id: id as any });
      toast.success('Archived');
    } catch (e: any) {
      toast.error('Failed');
    }
  };

  const handleRestore = async () => {
    try {
      await unarchiveSO.mutateAsync({ id: id as any });
      toast.success('Restored');
    } catch (e: any) {
      toast.error('Failed');
    }
  };

  const handleDuplicate = async () => {
    try {
      const newId = await duplicateSO.mutateAsync({ id: id as any });
      toast.success('Duplicated');
      router.push(`/sales/${newId}`);
    } catch (e: any) {
      toast.error('Failed');
    }
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!so) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <ShoppingCart className="h-12 w-12 text-muted-foreground/50" />
        <p className="mt-3 text-muted-foreground">Sale order not found</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => router.push('/sales')}>
          <ArrowLeft className="mr-1 h-4 w-4" />Back to Sales
        </Button>
      </div>
    );
  }

  const actions = WORKFLOW_ACTIONS[so.state] ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/sales')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
              <ShoppingCart className="size-4" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{so.number}</h2>
              <Badge variant="secondary" className={STATE_COLORS[so.state] ?? ''}>{so.state}</Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {so.invoiceStatus !== 'invoiced' && ['confirmed', 'invoiced', 'delivered', 'done'].includes(so.state) && (
            <Button variant="default" size="sm" onClick={handleCreateInvoice}>
              <FileText className="mr-1 h-4 w-4" />Create Invoice
            </Button>
          )}
          {actions.filter(a => a.target !== 'invoiced').map((action) => (
            <Button key={action.target} variant={action.variant} size="sm" onClick={() => handleTransition(action.target)}>
              <action.icon className="mr-1 h-4 w-4" />{action.label}
            </Button>
          ))}
          <Button variant="outline" size="sm" onClick={handleDuplicate}>
            <Copy className="mr-1 h-4 w-4" />Duplicate
          </Button>
          {['draft', 'sent'].includes(so.state) && (
            <Button variant="outline" size="sm" onClick={() => router.push(`/sales/${id}/edit`)}>
              <Pencil className="mr-1 h-4 w-4" />Edit
            </Button>
          )}
          {so.archivedAt ? (
            <Button variant="outline" size="sm" onClick={handleRestore}>
              <RotateCcw className="mr-1 h-4 w-4" />Restore
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handleArchive}>
              <Archive className="mr-1 h-4 w-4" />Archive
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Customer & Dates */}
        <Card>
          <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <DetailRow label="Customer" value={so.companyName ?? so.contactName} />
            <DetailRow label="Order Date" value={new Date(so.orderDate).toLocaleDateString('id-ID')} />
            {so.validUntil && <DetailRow label="Valid Until" value={new Date(so.validUntil).toLocaleDateString('id-ID')} />}
            {so.deliveryDate && <DetailRow label="Delivery Date" value={new Date(so.deliveryDate).toLocaleDateString('id-ID')} />}
            <DetailRow label="Source" value={so.source} />
          </CardContent>
        </Card>

        {/* Amounts */}
        <Card>
          <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Amounts</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <DetailRow label="Subtotal" value={formatMoney(so.subtotal)} />
            {so.discountAmount != null && (
              <DetailRow label={`Discount${so.discountType === 'percentage' ? ` (${so.discountAmount}%)` : ''}`} value={`-${formatMoney(so.discountType === 'percentage' ? so.subtotal * so.discountAmount / 100 : so.discountAmount)}`} />
            )}
            {so.taxAmount != null && <DetailRow label="Tax" value={formatMoney(so.taxAmount)} />}
            <DetailRow label="Total" value={formatMoney(so.totalAmount)} />
            <DetailRow label="Invoice" value={so.invoiceStatus} />
            <DetailRow label="Delivery" value={so.deliveryStatus} />
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Notes</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <DetailRow label="Customer Notes" value={so.customerNotes} />
            <DetailRow label="Internal Notes" value={so.internalNotes} />
            <DetailRow label="Terms" value={so.terms} />
          </CardContent>
        </Card>
      </div>

      {/* Lines */}
      <Card>
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Order Lines ({so.lines.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {so.lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>
                    <div>
                      <span className="font-medium">{line.productName}</span>
                      {line.description && <p className="text-xs text-muted-foreground">{line.description}</p>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{line.quantity}</TableCell>
                  <TableCell className="text-right">{formatMoney(line.unitPrice)}</TableCell>
                  <TableCell className="text-right">
                    {line.discount != null
                      ? line.discountType === 'percentage' ? `${line.discount}%` : formatMoney(line.discount)
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right">{line.taxAmount != null ? formatMoney(line.taxAmount) : '—'}</TableCell>
                  <TableCell className="text-right font-medium">{formatMoney(line.subtotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value ?? '—'}</span>
    </div>
  );
}
