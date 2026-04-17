'use client';

import { useAuthQuery, useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { useParams, useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Building2,
  Handshake,
  Percent,
  User,
  XCircle,
  Clock,
  Archive,
  RotateCcw,
  ShoppingCart,
} from 'lucide-react';
import { format } from '@/lib/format-date';
import Link from 'next/link';
import { toast } from 'sonner';
import { STAGE_COLORS } from '@/lib/constants';
import { formatCurrency } from '@/lib/format';
import { ActivityTimeline } from '@/components/activities/activity-timeline';

export default function DealDetailPage() {
  const params = useParams();
  const router = useRouter();
  const dealId = params.id as string;

  const { data: deal, isLoading } = useAuthQuery(api.deals.getById, { id: dealId as any });
  const archiveDeal = useAuthMutation(api.deals.archive);
  const restoreDeal = useAuthMutation(api.deals.restore);
  const convertToSO = useAuthMutation(api.deals.convertToSaleOrder);

  const handleConvertToSO = async () => {
    try {
      const soId = await convertToSO.mutateAsync({
        id: dealId as any,
        lines: [
          {
            productName: deal?.title ?? 'Deal Item',
            quantity: 1,
            unitPrice: deal?.value ?? 0,
          },
        ],
      });
      toast.success('Converted to Sale Order');
      router.push(`/sales/${soId}`);
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Conversion failed');
    }
  };

  const handleArchive = async () => {
    try {
      await archiveDeal.mutateAsync({ id: dealId as any });
      toast.success('Deal archived');
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to archive');
    }
  };

  const handleRestore = async () => {
    try {
      await restoreDeal.mutateAsync({ id: dealId as any });
      toast.success('Deal restored');
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to restore');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Handshake className="size-12 text-muted-foreground/50" />
        <p className="mt-3 text-sm text-muted-foreground">Deal not found</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => router.push('/deals')}>
          Back to Deals
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/deals')}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h2 className="text-xl font-semibold">{deal.title}</h2>
            <div className="mt-1 flex items-center gap-2">
              <Badge className={STAGE_COLORS[deal.stage] ?? ''}>
                {deal.stage}
              </Badge>
              {deal.archivedAt && (
                <Badge variant="secondary" className="bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400">
                  Archived
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {deal.stage === 'won' && (
            <Button variant="default" size="sm" onClick={handleConvertToSO} disabled={convertToSO.isPending}>
              <ShoppingCart className="mr-1 h-4 w-4" />
              {convertToSO.isPending ? 'Converting...' : 'Convert to SO'}
            </Button>
          )}
          {deal.archivedAt ? (
            <Button variant="outline" size="sm" onClick={handleRestore}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              Restore
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handleArchive}>
              <Archive className="mr-1 h-3.5 w-3.5" />
              Archive
            </Button>
          )}
        </div>
      </div>

      {/* Deal Info Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Value */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Handshake className="size-4" />
              Deal Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-bold">
              {deal.value != null ? formatCurrency(deal.value, deal.currency) : '—'}
            </p>
            {deal.currency && (
              <p className="mt-1 text-xs text-muted-foreground">{deal.currency}</p>
            )}
          </CardContent>
        </Card>

        {/* Probability */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Percent className="size-4" />
              Probability
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <p className="text-2xl font-bold">
                {deal.probability != null ? `${deal.probability}%` : '—'}
              </p>
              {deal.probability != null && (
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all"
                    style={{ width: `${deal.probability}%` }}
                  />
                </div>
              )}
            </div>
            {deal.value != null && deal.probability != null && (
              <p className="mt-1 text-xs text-muted-foreground">
                Weighted: {formatCurrency(deal.value * deal.probability / 100, deal.currency)}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Clock className="size-4" />
              Timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              Created: {format(new Date(deal.createdAt), 'MMM d, yyyy')}
            </p>
            {deal.expectedCloseDate && (
              <p>
                Expected close: {format(new Date(deal.expectedCloseDate), 'MMM d, yyyy')}
              </p>
            )}
            {deal.wonAt && (
              <p className="text-green-600 dark:text-green-400">
                Won: {format(new Date(deal.wonAt), 'MMM d, yyyy')}
              </p>
            )}
            {deal.lostAt && (
              <p className="text-red-600 dark:text-red-400">
                Lost: {format(new Date(deal.lostAt), 'MMM d, yyyy')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Related Records */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Company */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Building2 className="size-4" />
              Company
            </CardTitle>
          </CardHeader>
          <CardContent>
            {deal.companyName ? (
              <Link
                href={`/companies/${deal.companyId}`}
                className="flex items-center gap-2 font-medium transition-colors hover:text-indigo-600"
              >
                <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
                  <Building2 className="size-4" />
                </div>
                {deal.companyName}
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">No company linked</p>
            )}
          </CardContent>
        </Card>

        {/* Primary Contact */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <User className="size-4" />
              Primary Contact
            </CardTitle>
          </CardHeader>
          <CardContent>
            {deal.primaryContactName ? (
              <Link
                href={`/contacts/${deal.primaryContactId}`}
                className="font-medium transition-colors hover:text-indigo-600"
              >
                {deal.primaryContactName}
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">No contact linked</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Timeline */}
      <ActivityTimeline entityType="deal" entityId={dealId} />

      {/* Lost Reason */}
      {deal.lostReason && (
        <Card className="border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400">
              <XCircle className="size-4" />
              Lost Reason
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{deal.lostReason}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
