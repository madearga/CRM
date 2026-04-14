'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Package } from 'lucide-react';

import { api } from '@convex/_generated/api';
import { usePublicQuery, useIsAuth, usePublicMutation } from '@/lib/convex/hooks';
import { useCurrentUser } from '@/lib/convex/hooks/useCurrentUser';
import { OrderStatusBadge } from '@/components/shop/order-status-badge';
import { formatIDR } from '@/lib/commerce/format-currency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

export default function OrderDetailPage() {
  const router = useRouter();
  const { id: orderNumber } = useParams<{ id: string }>();
  const isAuth = useIsAuth();
  const user = useCurrentUser();
  const orgSlug = user?.activeOrganization?.slug;

  const { data: order, isLoading } = usePublicQuery(
    api.commerce.orders.getOrderDetail,
    orderNumber && orgSlug ? { orderNumber, organizationSlug: orgSlug } : 'skip',
  );

  const cancelOrder = usePublicMutation(api.commerce.orders.cancelOrder as any);

  if (!isAuth) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <Package className="mx-auto size-12 text-muted-foreground" />
        <h2 className="mt-4 text-xl font-semibold">Sign in to view this order</h2>
        <Button className="mt-4" onClick={() => router.push('/shop')}>
          Go to Shop
        </Button>
      </div>
    );
  }

  if (isLoading || !order) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Skeleton className="mb-6 h-8 w-48" />
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-60 w-full" />
        </div>
      </div>
    );
  }

  const timeline = order.orderTimeline ?? [];
  const isPendingPayment = order.status === 'pending_payment';
  const isPaid = order.paymentStatus === 'paid' || order.status === 'paid' || order.status === 'processing' || order.status === 'shipped';

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/shop/orders')}>
          <ArrowLeft className="size-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Order #{order.orderNumber}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(order.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <div className="ml-auto">
          <OrderStatusBadge status={order.status} />
        </div>
      </div>

      {/* Status Timeline */}
      {timeline.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Order Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {timeline.map((entry: any, idx: number) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className={`mt-1.5 size-2 rounded-full ${idx === timeline.length - 1 ? 'bg-foreground' : 'bg-muted-foreground'}`} />
                  <div>
                    <p className="text-sm font-medium capitalize">{(entry.status as string).replace(/_/g, ' ')}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    {entry.note && <p className="text-xs text-muted-foreground">{entry.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      {isPendingPayment && (
        <div className="mb-6 flex gap-3">
          <Button variant="outline" onClick={() => { /* TODO: check payment status */ }}>
            Check Payment Status
          </Button>
          <Button
            variant="destructive"
            disabled={cancelOrder.isPending}
            onClick={async () => {
              try {
                await cancelOrder.mutateAsync({ orderNumber: order.orderNumber, organizationSlug: orgSlug } as any);
                router.push('/shop/orders');
              } catch {
                /* handled by mutation */
              }
            }}
          >
            {cancelOrder.isPending ? 'Cancelling...' : 'Cancel Order'}
          </Button>
        </div>
      )}

      {/* Delivery info for paid orders */}
      {isPaid && (
        <Card className="mb-6 border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-green-800 dark:text-green-300">
              Payment confirmed — your order is being processed.
            </p>
            <p className="mt-1 text-xs text-green-700 dark:text-green-400">
              Estimated delivery: 3–5 business days
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Items */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {order.items.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex-1">
                    <p className="font-medium">{item.productName}</p>
                    {item.variantId && (
                      <p className="text-xs text-muted-foreground">Variant: {item.variantId}</p>
                    )}
                    <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">{formatIDR(item.productPrice)} × {item.quantity}</p>
                    <p className="font-semibold">{formatIDR(item.subtotal)}</p>
                  </div>
                </div>
              ))}
            </div>
            <Separator className="my-4" />
            <div className="space-y-1 text-sm">
              {order.shippingCost > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>{formatIDR(order.shippingCost)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span>{formatIDR(order.totalAmount)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shipping Address */}
        {order.shippingAddress && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Shipping Address</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-line">{order.shippingAddress}</p>
            </CardContent>
          </Card>
        )}

        {/* Payment Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Payment</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>
              <span className="text-muted-foreground">Status: </span>
              <span className="font-medium capitalize">{(order.paymentStatus as string).replace(/_/g, ' ')}</span>
            </p>
            {order.customer && (
              <>
                <p className="mt-2 text-muted-foreground">Customer</p>
                <p>{order.customer.name}</p>
                <p className="text-muted-foreground">{order.customer.email}</p>
                {order.customer.phone && <p className="text-muted-foreground">{order.customer.phone}</p>}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}