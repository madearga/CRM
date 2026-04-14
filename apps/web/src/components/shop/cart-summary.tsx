'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { formatIDR } from '@/lib/commerce/format-currency';
import { usePublicMutation } from '@/lib/convex/hooks/convex-hooks';
import { FunctionReference } from 'convex/server';
import { toast } from 'sonner';
import { Loader2, Trash2 } from 'lucide-react';

interface CartSummaryProps {
  subtotal: number;
  shippingCost: number;
  totalAmount: number;
  organizationSlug: string;
  sessionId?: string;
  itemCount: number;
  onCleared?: () => void;
}

export function CartSummary({
  subtotal,
  shippingCost,
  totalAmount,
  organizationSlug,
  sessionId,
  itemCount,
  onCleared,
}: CartSummaryProps) {
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  const clearCart = usePublicMutation(
    'commerce/cart:clearCart' as unknown as FunctionReference<'mutation', 'public', any, any>,
    {
    onSuccess: () => {
      setClearDialogOpen(false);
      toast.success('Cart cleared');
      onCleared?.();
    },
    onError: (err: any) => {
      toast.error(err?.data?.message ?? 'Failed to clear cart');
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Order Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal ({itemCount} item{itemCount !== 1 ? 's' : ''})</span>
          <span>{formatIDR(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Shipping</span>
          <span>{shippingCost === 0 ? 'Free' : formatIDR(shippingCost)}</span>
        </div>
        <Separator />
        <div className="flex justify-between font-bold">
          <span>Total</span>
          <span>{formatIDR(totalAmount)}</span>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        <Button asChild className="w-full" size="lg">
          <Link href="/shop/checkout">Proceed to Checkout</Link>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link href="/shop/products">Continue Shopping</Link>
        </Button>

        <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              className="w-full text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-2 size-4" />
              Clear Cart
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear your cart?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove all items from your cart. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  clearCart.mutate({
                    organizationSlug,
                    sessionId: sessionId as any,
                  } as any);
                }}
                disabled={clearCart.isPending}
              >
                {clearCart.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                Clear Cart
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}