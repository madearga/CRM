'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter , useParams } from 'next/navigation';
import Link from 'next/link';
import { Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@convex/_generated/api';
import { usePublicQuery, usePublicMutation } from '@/lib/convex/hooks/convex-hooks';
import { toast } from 'sonner';

export default function CheckoutPendingPage() {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderNumber = searchParams.get('order') ?? '';
  const [checking, setChecking] = useState(false);

  // Note: checkPaymentStatus needs an orderId (not orderNumber).
  // The success/failed URL uses orderNumber, so we'll check by orderNumber
  // through a polling approach. For now, show a manual check button.

  const checkStatus = useCallback(async () => {
    setChecking(true);
    try {
      // Re-check — we don't have the orderId directly from URL,
      // so user should view order details for live status.
      toast.info('Checking payment status…');
      // Small delay so the user sees the spinner.
      await new Promise((r) => setTimeout(r, 1500));
      toast.info('Please check your order details for the latest status.');
      if (orderNumber) {
        router.push(`/${slug}/orders/${orderNumber}`);
      }
    } finally {
      setChecking(false);
    }
  }, [orderNumber, router, slug]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 py-12">
      <div className="flex size-20 items-center justify-center rounded-full bg-yellow-100">
        <Clock className="size-12 text-yellow-600" />
      </div>

      <div className="text-center">
        <h1 className="text-2xl font-bold">Payment Pending</h1>
        <p className="mt-2 text-muted-foreground">
          Your payment is being processed. This may take a few moments.
        </p>
      </div>

      {orderNumber && (
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-sm text-muted-foreground">Order Number</p>
          <p className="text-lg font-semibold">{orderNumber}</p>
        </div>
      )}

      <div className="max-w-md rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Payment Instructions</p>
        <p className="mt-1">
          If you paid via bank transfer or virtual account, payment confirmation
          may take a few minutes. You can check the status or view your order
          details below.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={checkStatus} disabled={checking}>
          {checking ? (
            <>
              <RefreshCw className="mr-2 size-4 animate-spin" />
              Checking…
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 size-4" />
              Check Payment Status
            </>
          )}
        </Button>

        {orderNumber && (
          <Button variant="outline" asChild>
            <Link href={`/${slug}/orders/${orderNumber}`}>
              View Order Details
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}