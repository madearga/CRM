'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Package, ShoppingBag } from 'lucide-react';

import { api } from '@convex/_generated/api';
import { useAuthPaginatedQuery, useIsAuth } from '@/lib/convex/hooks';
import { useCurrentUser } from '@/lib/convex/hooks/useCurrentUser';
import { OrderStatusBadge } from '@/components/shop/order-status-badge';
import { formatIDR } from '@/lib/commerce/format-currency';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function OrdersPage() {
  const router = useRouter();
  const isAuth = useIsAuth();
  const user = useCurrentUser();
  const orgSlug = user?.activeOrganization?.slug;

  const { data, isLoading } = useAuthPaginatedQuery(
    api.commerce.customers.getOrders,
    orgSlug ? { organizationSlug: orgSlug } : 'skip',
    { initialNumItems: 20 },
  );

  if (!isAuth) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <Package className="mx-auto size-12 text-muted-foreground" />
        <h2 className="mt-4 text-xl font-semibold">Sign in to view orders</h2>
        <p className="mt-2 text-muted-foreground">You need to be logged in to see your order history.</p>
        <Button className="mt-4" onClick={() => router.push('/shop')}>
          Go to Shop
        </Button>
      </div>
    );
  }

  const orders = data ?? [];

  if (!isLoading && orders.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <ShoppingBag className="mx-auto size-12 text-muted-foreground" />
        <h2 className="mt-4 text-xl font-semibold">No orders yet</h2>
        <p className="mt-2 text-muted-foreground">When you place your first order, it will appear here.</p>
        <Link href="/shop">
          <Button className="mt-4">Browse Products</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">My Orders</h1>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Link key={order.orderNumber} href={`/shop/orders/${order.orderNumber}`}>
              <Card className="cursor-pointer transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="space-y-1">
                    <p className="font-medium">#{order.orderNumber}</p>
                    <p className="text-sm text-muted-foreground">
                      {order.createdAt
                        ? new Date(order.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold">{formatIDR(order.totalAmount)}</p>
                    </div>
                    <OrderStatusBadge status={order.status} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}