'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ShoppingCart, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CartItemRow, type CartItemData } from '@/components/shop/cart-item-row';
import { CartSummary } from '@/components/shop/cart-summary';
import { usePublicQuery, usePublicMutation } from '@/lib/convex/hooks/convex-hooks';
import { useConvexAuth } from 'convex/react';
import { api } from '@convex/_generated/api';

const ORG_SLUG = 'default';
const SESSION_KEY = 'shop_session_id';

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export default function CartPage() {
  const [sessionId, setSessionId] = useState<string>('');
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const [merged, setMerged] = useState(false);

  // Initialize session ID on mount
  useEffect(() => {
    setSessionId(getOrCreateSessionId());
  }, []);

  // Merge guest cart on login
  const mergeGuestCart = usePublicMutation(
    api.commerce.cart.mergeGuestCart as any,
    {
    onSuccess: () => {
      setMerged(true);
    },
    onError: () => {
      // Non-critical, still show cart
      setMerged(true);
    },
  });

  useEffect(() => {
    if (isAuthenticated && !merged && sessionId) {
      mergeGuestCart.mutate({
        organizationSlug: ORG_SLUG,
        sessionId,
      } as any);
    }
  }, [isAuthenticated, merged, sessionId]);

  // Fetch cart
  const cartQueryArgs = useMemo(
    () =>
      sessionId
        ? ({
            organizationSlug: ORG_SLUG,
            sessionId: isAuthenticated ? undefined : sessionId,
          } as any)
        : 'skip',
    [sessionId, isAuthenticated],
  );

  const { data: cart, isLoading, isError } = usePublicQuery(
    api.commerce.cart.getCart,
    cartQueryArgs,
  );

  const items: CartItemData[] = cart?.items ?? [];
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const shippingCost = subtotal > 0 ? (subtotal >= 500000 ? 0 : 25000) : 0;
  const totalAmount = subtotal + shippingCost;

  // Loading state
  if (isLoading || authLoading || (isAuthenticated && !merged)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-destructive">Failed to load cart</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  // Empty cart
  if (!cart || items.length === 0) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-3xl flex-col items-center justify-center gap-6 px-4 py-16">
        <ShoppingCart className="size-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Your cart is empty</h1>
        <p className="text-muted-foreground">Looks like you haven&apos;t added anything yet.</p>
        <Button asChild size="lg">
          <Link href="/shop/products">Browse Products</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-8 text-2xl font-bold">Shopping Cart</h1>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Item List */}
        <div className="lg:col-span-2">
          {items.map((item) => (
            <CartItemRow
              key={item.id}
              item={item}
              sessionId={isAuthenticated ? undefined : sessionId}
              onUpdated={() => {
                // Refetch happens reactively via Convex
              }}
            />
          ))}
        </div>

        {/* Summary Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <CartSummary
              subtotal={subtotal}
              shippingCost={shippingCost}
              totalAmount={totalAmount}
              organizationSlug={ORG_SLUG}
              sessionId={isAuthenticated ? undefined : sessionId}
              itemCount={items.reduce((acc, i) => acc + i.quantity, 0)}
              onCleared={() => {
                // Refetch happens reactively via Convex
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}