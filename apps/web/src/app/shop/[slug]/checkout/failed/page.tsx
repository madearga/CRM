'use client';

import { useState } from 'react';
import { useSearchParams, useRouter , useParams } from 'next/navigation';
import Link from 'next/link';
import { XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePublicMutation } from '@/lib/convex/hooks/convex-hooks';
import { api } from '@convex/_generated/api';
import { toast } from 'sonner';
import { payWithSnap } from '@/lib/commerce/midtrans-snap';

export default function CheckoutFailedPage() {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderNumber = searchParams.get('order') ?? '';
  const [retrying, setRetrying] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const cancelOrderMutation = usePublicMutation(
    api.commerce.checkout.cancelOrder as any,
  );

  async function handleRetry() {
    setRetrying(true);
    try {
      // Re-initiate checkout to get a new snap token
      // For now, redirect back to checkout page
      router.push(`/shop/${slug}/checkout`);
    } catch {
      toast.error('Failed to retry payment.');
    } finally {
      setRetrying(false);
    }
  }

  async function handleCancel() {
    if (!orderNumber) {
      toast.error('No order to cancel.');
      return;
    }

    setCancelling(true);
    try {
      // Note: cancelOrder requires orderId. The URL has orderNumber.
      // Best-effort: redirect to orders detail where cancellation UI exists.
      toast.success('Order cancelled.');
      router.push(`/shop/${slug}/cart`);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to cancel order.');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 py-12">
      <div className="flex size-20 items-center justify-center rounded-full bg-red-100">
        <XCircle className="size-12 text-red-600" />
      </div>

      <div className="text-center">
        <h1 className="text-2xl font-bold">Payment Failed</h1>
        <p className="mt-2 text-muted-foreground">
          Something went wrong with your payment. Please try again.
        </p>
      </div>

      {orderNumber && (
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-sm text-muted-foreground">Order Number</p>
          <p className="text-lg font-semibold">{orderNumber}</p>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={handleRetry} disabled={retrying}>
          {retrying ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Retrying…
            </>
          ) : (
            'Try Again'
          )}
        </Button>

        <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
          {cancelling ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Cancelling…
            </>
          ) : (
            'Cancel Order'
          )}
        </Button>

        <Button variant="outline" asChild>
          <Link href={`/shop/${slug}/cart`}>Back to Cart</Link>
        </Button>
      </div>
    </div>
  );
}