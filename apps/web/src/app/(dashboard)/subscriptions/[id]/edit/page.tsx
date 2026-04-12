'use client';

import { useAuthQuery } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Skeleton } from '@/components/ui/skeleton';
import { SubscriptionForm } from '@/components/subscriptions/subscription-form';
import { useParams } from 'next/navigation';

export default function EditSubscriptionPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: subscription, isLoading } = useAuthQuery(api.subscriptions.getById, { id: id as any });

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!subscription) {
    return <div className="text-center py-12 text-muted-foreground">Subscription not found</div>;
  }

  return (
    <div className="container mx-auto py-6">
      <SubscriptionForm
        subscriptionId={id}
        initialData={{
          name: subscription.name,
          description: subscription.description ?? undefined,
          interval: subscription.interval,
          intervalCount: subscription.intervalCount ?? undefined,
          billingDay: subscription.billingDay,
          startDate: subscription.startDate,
          endDate: subscription.endDate ?? undefined,
          autoGenerateInvoice: subscription.autoGenerateInvoice ?? undefined,
          autoPostInvoice: subscription.autoPostInvoice ?? undefined,
          numberOfInvoices: subscription.numberOfInvoices ?? undefined,
          currency: subscription.currency ?? undefined,
          notes: subscription.notes ?? undefined,
          discountAmount: subscription.discountAmount ?? undefined,
          discountType: subscription.discountType ?? undefined,
          paymentTermId: subscription.paymentTermId ?? undefined,
          companyId: subscription.companyId ?? undefined,
          contactId: subscription.contactId ?? undefined,
          lines: subscription.lines.map((l: any) => ({
            id: l.id,
            productName: l.productName,
            description: l.description ?? undefined,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discount: l.discount ?? undefined,
            discountType: l.discountType ?? undefined,
            taxAmount: l.taxAmount ?? undefined,
            productId: l.productId ?? undefined,
            taxId: l.taxId ?? undefined,
          })),
        }}
      />
    </div>
  );
}
