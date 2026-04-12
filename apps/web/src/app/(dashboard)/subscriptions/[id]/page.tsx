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
  ArrowLeft, RefreshCw, Archive, RotateCcw, Pencil,
  Play, Pause, XCircle, FileText, ExternalLink, Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { useParams, useRouter } from 'next/navigation';
import { formatMoney } from '@/lib/format-money';
import Link from 'next/link';

const STATE_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  paused: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  expired: "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const INTERVAL_COLORS: Record<string, string> = {
  weekly: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  monthly: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  quarterly: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  yearly: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

export default function SubscriptionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: sub, isLoading } = useAuthQuery(api.subscriptions.getById, { id: id as any });
  const pauseSub = useAuthMutation(api.subscriptions.pause);
  const resumeSub = useAuthMutation(api.subscriptions.resume);
  const cancelSub = useAuthMutation(api.subscriptions.cancel);
  const archiveSub = useAuthMutation(api.subscriptions.archive);
  const unarchiveSub = useAuthMutation(api.subscriptions.unarchive);
  const generateInv = useAuthMutation(api.subscriptions.generateInvoice);

  const handlePause = async () => {
    try {
      await pauseSub.mutateAsync({ id: id as any });
      toast.success('Subscription paused');
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed');
    }
  };

  const handleResume = async () => {
    try {
      await resumeSub.mutateAsync({ id: id as any });
      toast.success('Subscription resumed');
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed');
    }
  };

  const handleCancel = async () => {
    try {
      await cancelSub.mutateAsync({ id: id as any });
      toast.success('Subscription cancelled');
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed');
    }
  };

  const handleGenerate = async () => {
    try {
      const invId = await generateInv.mutateAsync({ id: id as any });
      toast.success('Invoice generated');
      router.push(`/invoices/${invId}`);
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed');
    }
  };

  const handleArchive = async () => {
    try {
      await archiveSub.mutateAsync({ id: id as any });
      toast.success('Archived');
    } catch (e: any) {
      toast.error('Failed');
    }
  };

  const handleRestore = async () => {
    try {
      await unarchiveSub.mutateAsync({ id: id as any });
      toast.success('Restored');
    } catch (e: any) {
      toast.error('Failed');
    }
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!sub) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <RefreshCw className="h-12 w-12 text-muted-foreground/50" />
        <p className="mt-3 text-muted-foreground">Subscription not found</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => router.push('/subscriptions')}>
          <ArrowLeft className="mr-1 h-4 w-4" />Back to Subscriptions
        </Button>
      </div>
    );
  }

  const state = sub.state ?? 'active';

  // Calculate total revenue from generated invoices
  const totalRevenue = sub.generatedInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/subscriptions')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-900/40 dark:text-slate-400">
              <RefreshCw className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{sub.name}</h2>
                <Badge variant="secondary" className={STATE_COLORS[state]}>
                  {state}
                </Badge>
                <Badge variant="secondary" className={INTERVAL_COLORS[sub.interval]}>
                  {sub.interval}
                </Badge>
              </div>
              {sub.description && <p className="text-sm text-muted-foreground">{sub.description}</p>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {state === 'active' && (
            <>
              <Button size="sm" onClick={handleGenerate} disabled={generateInv.isPending}>
                <FileText className="mr-1 h-4 w-4" />Generate Invoice
              </Button>
              <Button variant="outline" size="sm" onClick={handlePause}>
                <Pause className="mr-1 h-4 w-4" />Pause
              </Button>
              <Button variant="outline" size="sm" onClick={() => router.push(`/subscriptions/${id}/edit`)}>
                <Pencil className="mr-1 h-4 w-4" />Edit
              </Button>
            </>
          )}
          {state === 'paused' && (
            <Button size="sm" onClick={handleResume}>
              <Play className="mr-1 h-4 w-4" />Resume
            </Button>
          )}
          {['active', 'paused'].includes(state) && (
            <Button variant="destructive" size="sm" onClick={handleCancel}>
              <XCircle className="mr-1 h-4 w-4" />Cancel
            </Button>
          )}
          {sub.archivedAt ? (
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

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Generated</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sub.generatedCount ?? 0}{sub.numberOfInvoices ? `/${sub.numberOfInvoices}` : ''}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Next Billing</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sub.nextBillingDate
                ? new Date(sub.nextBillingDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                : '—'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Total Revenue</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(totalRevenue, sub.currency)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Per Invoice</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(sub.lines.reduce((sum, l) => sum + l.subtotal, 0), sub.currency)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Billing Config</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <DetailRow label="Interval" value={sub.interval} />
            <DetailRow label="Every" value={`${sub.intervalCount ?? 1} ${sub.interval}(s)`} />
            <DetailRow label="Billing Day" value={`${sub.billingDay}`} />
            <DetailRow label="Start Date" value={new Date(sub.startDate).toLocaleDateString('id-ID')} />
            <DetailRow label="End Date" value={sub.endDate ? new Date(sub.endDate).toLocaleDateString('id-ID') : 'Indefinite'} />
            <DetailRow label="Auto-generate" value={sub.autoGenerateInvoice ? 'Yes' : 'No'} />
            <DetailRow label="Auto-post" value={sub.autoPostInvoice ? 'Yes' : 'No'} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Customer</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <DetailRow label="Company" value={sub.companyName ?? '—'} />
            <DetailRow label="Contact" value={sub.contactName ?? '—'} />
            <DetailRow label="Currency" value={sub.currency ?? 'IDR'} />
            <DetailRow label="Payment Terms" value={sub.paymentTermId ? 'Set' : 'Default (30 days)'} />
            {sub.discountAmount != null && (
              <DetailRow
                label={`Discount${sub.discountType === 'percentage' ? ` (${sub.discountAmount}%)` : ''}`}
                value={sub.discountType === 'percentage' ? `${sub.discountAmount}%` : formatMoney(sub.discountAmount, sub.currency)}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Notes</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{sub.notes || 'No notes'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Lines */}
      <Card>
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Line Items ({sub.lines.length})</CardTitle></CardHeader>
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
              {sub.lines.map((line: any) => (
                <TableRow key={line.id}>
                  <TableCell>
                    <div>
                      <span className="font-medium">{line.productName}</span>
                      {line.description && <p className="text-xs text-muted-foreground">{line.description}</p>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{line.quantity}</TableCell>
                  <TableCell className="text-right">{formatMoney(line.unitPrice, sub.currency)}</TableCell>
                  <TableCell className="text-right">
                    {line.discount != null
                      ? line.discountType === 'percentage' ? `${line.discount}%` : formatMoney(line.discount, sub.currency)
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right">{line.taxAmount != null ? formatMoney(line.taxAmount, sub.currency) : '—'}</TableCell>
                  <TableCell className="text-right font-medium">{formatMoney(line.subtotal, sub.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Generated Invoices */}
      <Card>
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Generated Invoices ({sub.generatedInvoices.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {sub.generatedInvoices.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No invoices generated yet</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sub.generatedInvoices.map((inv: any) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <Link href={`/invoices/${inv.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                        {inv.number}
                      </Link>
                    </TableCell>
                    <TableCell>{new Date(inv.invoiceDate).toLocaleDateString('id-ID')}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={STATE_COLORS[inv.state] ?? ''}>{inv.state}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatMoney(inv.totalAmount, inv.currency)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/invoices/${inv.id}`}><ExternalLink className="h-3.5 w-3.5" /></Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
