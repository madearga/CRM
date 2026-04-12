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
  ArrowLeft, FileText, Archive, RotateCcw, Pencil,
  Send, XCircle, CreditCard, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { useParams, useRouter } from 'next/navigation';
import { formatMoney } from '@/lib/format-money';
import { useState } from 'react';
import { PaymentDialog } from '@/components/invoices/payment-dialog';
import { PaymentMethodBadge } from '@/components/invoices/payment-method-badge';
import { InvoiceTypeBadge } from '@/components/invoices/invoice-type-badge';
import { InvoiceStatusBadge } from '@/components/invoices/invoice-status-badge';
import Link from 'next/link';
import { useMemo } from 'react';
import { PdfDownloadButton } from '@/components/pdf-download-button';
import { InvoicePDF } from '@/pdf/invoice-pdf';
import type { InvoicePDFData } from '@/pdf/invoice-pdf';

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  const { data: invoice, isLoading } = useAuthQuery(api.invoices.getById, { id: id as any });
  const postInvoice = useAuthMutation(api.invoices.post);
  const cancelInvoice = useAuthMutation(api.invoices.cancel);
  const archiveInvoice = useAuthMutation(api.invoices.archive);
  const unarchiveInvoice = useAuthMutation(api.invoices.unarchive);

  const handlePost = async () => {
    try {
      await postInvoice.mutateAsync({ id: id as any });
      toast.success('Invoice posted');
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to post invoice');
    }
  };

  const handleCancel = async () => {
    try {
      await cancelInvoice.mutateAsync({ id: id as any });
      toast.success('Invoice cancelled');
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to cancel invoice');
    }
  };

  const handleArchive = async () => {
    try {
      await archiveInvoice.mutateAsync({ id: id as any });
      toast.success('Archived');
    } catch (e: any) {
      toast.error('Failed');
    }
  };

  const handleRestore = async () => {
    try {
      await unarchiveInvoice.mutateAsync({ id: id as any });
      toast.success('Restored');
    } catch (e: any) {
      toast.error('Failed');
    }
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <FileText className="h-12 w-12 text-muted-foreground/50" />
        <p className="mt-3 text-muted-foreground">Invoice not found</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => router.push('/invoices')}>
          <ArrowLeft className="mr-1 h-4 w-4" />Back to Invoices
        </Button>
      </div>
    );
  }

  const invoicePdfData: InvoicePDFData = useMemo(() => ({
    number: invoice.number,
    type: invoice.type,
    state: invoice.state,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    companyName: invoice.companyName,
    contactName: invoice.contactName,
    lines: invoice.lines.map((l: any) => ({
      productName: l.productName,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discount: l.discount,
      discountType: l.discountType,
      taxAmount: l.taxAmount,
      subtotal: l.subtotal,
    })),
    subtotal: invoice.subtotal,
    discountAmount: invoice.discountAmount,
    discountType: invoice.discountType,
    taxAmount: invoice.taxAmount,
    totalAmount: invoice.totalAmount,
    amountDue: invoice.amountDue,
    currency: invoice.currency,
    notes: invoice.notes,
    internalNotes: invoice.internalNotes,
    paymentTermName: invoice.paymentTermName,
  }), [invoice]);

  const canPost = invoice.state === 'draft';
  const canCancel = ['draft', 'posted'].includes(invoice.state);
  const canPay = ['draft', 'posted'].includes(invoice.state) && invoice.amountDue > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/invoices')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-900/40 dark:text-slate-400">
              <FileText className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{invoice.number}</h2>
                <InvoiceTypeBadge type={invoice.type} />
              </div>
              <div className="flex items-center gap-2">
                <InvoiceStatusBadge state={invoice.state} />
                {invoice.paymentStatus && (
                   <Badge variant="outline" className="text-[10px] uppercase h-4 px-1">
                     {invoice.paymentStatus.replace('_', ' ')}
                   </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canPost && (
            <Button size="sm" onClick={handlePost}>
              <Send className="mr-1 h-4 w-4" />Post Invoice
            </Button>
          )}
          {canPay && (
            <Button size="sm" onClick={() => setPaymentDialogOpen(true)}>
              <CreditCard className="mr-1 h-4 w-4" />Register Payment
            </Button>
          )}
          {canCancel && (
            <Button variant="destructive" size="sm" onClick={handleCancel}>
              <XCircle className="mr-1 h-4 w-4" />Cancel
            </Button>
          )}
          {invoice.state === 'draft' && (
            <Button variant="outline" size="sm" onClick={() => router.push(`/invoices/${id}/edit`)}>
              <Pencil className="mr-1 h-4 w-4" />Edit
            </Button>
          )}
          <PdfDownloadButton
            doc={<InvoicePDF data={invoicePdfData} />}
            fileName={`${invoice.number}.pdf`}
          />
          {invoice.archivedAt ? (
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
        {/* Details */}
        <Card>
          <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <DetailRow label="Customer/Vendor" value={invoice.companyName ?? invoice.contactName} />
            <DetailRow label="Invoice Date" value={new Date(invoice.invoiceDate).toLocaleDateString('id-ID')} />
            <DetailRow label="Due Date" value={new Date(invoice.dueDate).toLocaleDateString('id-ID')} />
            <DetailRow label="Source" value={invoice.source?.replace('_', ' ')} />
            {invoice.saleOrderId && (
              <DetailRow 
                label="Sale Order" 
                value={
                  <Link href={`/sales/${invoice.saleOrderId}`} className="flex items-center gap-1 text-blue-600 hover:underline">
                    View Order <ExternalLink className="h-3 w-3" />
                  </Link>
                } 
              />
            )}
          </CardContent>
        </Card>

        {/* Amounts */}
        <Card>
          <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Financials</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <DetailRow label="Subtotal" value={formatMoney(invoice.subtotal, invoice.currency)} />
            {invoice.discountAmount != null && (
              <DetailRow 
                label={`Discount${invoice.discountType === 'percentage' ? ` (${invoice.discountAmount}%)` : ''}`} 
                value={`-${formatMoney(invoice.discountType === 'percentage' ? invoice.subtotal * invoice.discountAmount / 100 : invoice.discountAmount, invoice.currency)}`} 
              />
            )}
            {invoice.taxAmount != null && <DetailRow label="Tax" value={formatMoney(invoice.taxAmount, invoice.currency)} />}
            <div className="border-t pt-2 mt-2">
              <DetailRow label="Total Amount" value={<span className="font-bold">{formatMoney(invoice.totalAmount, invoice.currency)}</span>} />
              <DetailRow label="Amount Due" value={<span className="font-bold text-red-600 dark:text-red-400">{formatMoney(invoice.amountDue, invoice.currency)}</span>} />
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Notes</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <DetailRow label="Customer Notes" value={invoice.notes} />
            <DetailRow label="Internal Notes" value={invoice.internalNotes} />
          </CardContent>
        </Card>
      </div>

      {/* Lines */}
      <Card>
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Lines ({invoice.lines.length})</CardTitle></CardHeader>
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
              {invoice.lines.map((line: any) => (
                <TableRow key={line.id}>
                  <TableCell>
                    <div>
                      <span className="font-medium">{line.productName}</span>
                      {line.description && <p className="text-xs text-muted-foreground">{line.description}</p>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{line.quantity}</TableCell>
                  <TableCell className="text-right">{formatMoney(line.unitPrice, invoice.currency)}</TableCell>
                  <TableCell className="text-right">
                    {line.discount != null
                      ? line.discountType === 'percentage' ? `${line.discount}%` : formatMoney(line.discount, invoice.currency)
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right">{line.taxAmount != null ? formatMoney(line.taxAmount, invoice.currency) : '—'}</TableCell>
                  <TableCell className="text-right font-medium">{formatMoney(line.subtotal, invoice.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Payments */}
      {invoice.payments.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Payments History</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.payments.map((payment: any) => (
                  <TableRow key={payment.id}>
                    <TableCell>{new Date(payment.paymentDate).toLocaleDateString('id-ID')}</TableCell>
                    <TableCell><PaymentMethodBadge method={payment.method} /></TableCell>
                    <TableCell className="text-muted-foreground">{payment.reference || '—'}</TableCell>
                    <TableCell className="text-right font-medium">{formatMoney(payment.amount, invoice.currency)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className={payment.state === 'confirmed' ? 'text-green-600' : 'text-red-600'}>
                        {payment.state}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <PaymentDialog
        invoiceId={id}
        invoiceNumber={invoice.number}
        amountDue={invoice.amountDue}
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
      />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: any }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="text-sm font-medium text-right">{value ?? '—'}</div>
    </div>
  );
}
