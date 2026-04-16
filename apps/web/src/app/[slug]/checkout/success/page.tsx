'use client';

import { useSearchParams , useParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CheckoutSuccessPage() {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get('order') ?? '';

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 py-12">
      <div className="flex size-20 items-center justify-center rounded-full bg-green-100">
        <CheckCircle2 className="size-12 text-green-600" />
      </div>

      <div className="text-center">
        <h1 className="text-2xl font-bold">Order Confirmed!</h1>
        <p className="mt-2 text-muted-foreground">
          Your payment was successful.
        </p>
      </div>

      {orderNumber && (
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-sm text-muted-foreground">Order Number</p>
          <p className="text-lg font-semibold">{orderNumber}</p>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        {orderNumber && (
          <Button asChild>
            <Link href={`/${slug}/orders/${orderNumber}`}>
              View Order Details
            </Link>
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link href={`/${slug}/products`}>Continue Shopping</Link>
        </Button>
      </div>
    </div>
  );
}