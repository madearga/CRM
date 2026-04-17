'use client';

import { useAuthQuery } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Skeleton } from '@/components/ui/skeleton';
import { ShoppingCart } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import dynamic from 'next/dynamic';

const SaleOrderForm = dynamic(
  () => import('@/components/sales/sale-order-form').then(m => ({ default: m.SaleOrderForm })),
  { loading: () => <div className="flex items-center justify-center py-16"><div className="animate-pulse text-muted-foreground">Loading...</div></div> }
);

export default function EditSaleOrderPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: so, isLoading } = useAuthQuery(api.saleOrders.getById, { id: id as any });

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!so || !['draft', 'sent'].includes(so.state)) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <ShoppingCart className="h-12 w-12 text-muted-foreground/50" />
        <p className="mt-3 text-muted-foreground">Cannot edit this order</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => router.push('/sales')}>
          <ArrowLeft className="mr-1 h-4 w-4" />Back to Sales
        </Button>
      </div>
    );
  }

  return (
    <SaleOrderForm
      saleOrderId={id}
      initialData={{
        companyId: so.companyId,
        contactId: so.contactId,
        orderDate: so.orderDate,
        validUntil: so.validUntil,
        deliveryDate: so.deliveryDate,
        deliveryAddress: so.deliveryAddress,
        internalNotes: so.internalNotes,
        customerNotes: so.customerNotes,
        terms: so.terms,
        currency: so.currency,
        discountAmount: so.discountAmount,
        discountType: so.discountType,
        lines: so.lines.map((l) => ({
          id: l.id,
          productName: l.productName,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discount: l.discount,
          discountType: l.discountType,
          taxAmount: l.taxAmount,
          productId: l.productId,
          productVariantId: l.productVariantId,
        })),
      }}
    />
  );
}
