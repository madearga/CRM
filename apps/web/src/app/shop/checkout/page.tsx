'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStatus } from '@/lib/convex/hooks/convex-hooks';
import { usePublicQuery, usePublicMutation } from '@/lib/convex/hooks/convex-hooks';
import { api } from '@convex/_generated/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Loader2, LogIn } from 'lucide-react';
import { CheckoutForm, type CheckoutFormValues, type CartItemDisplay } from '@/components/shop/checkout-form';
import { formatIDR } from '@/lib/commerce/format-currency';
import { payWithSnap } from '@/lib/commerce/midtrans-snap';
import { signIn } from '@/lib/convex/auth-client';

const ORG_SLUG = 'default';

export default function CheckoutPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuthStatus();

  // Cart data
  const { data: cart, isLoading: cartLoading } = usePublicQuery(
    api.commerce_cart.getCart as any,
    { organizationSlug: ORG_SLUG } as any,
  );

  // Customer profile for pre-fill
  const { data: customerProfile } = usePublicQuery(
    api.commerce_customers.getProfile as any,
    isAuthenticated ? { organizationSlug: ORG_SLUG } : ('skip' as any),
  );

  // Checkout mutation
  const initiateCheckoutMutation = usePublicMutation(
    api.commerce_checkout.initiateCheckout as any,
  );

  const [submitting, setSubmitting] = useState(false);

  // -----------------------------------------------------------------------
  // Auth gate
  // -----------------------------------------------------------------------
  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">Sign in to Checkout</h1>
        <p className="text-muted-foreground">
          Please sign in to complete your purchase.
        </p>
        <Button onClick={() => signIn.social({ provider: 'google', callbackURL: '/shop/checkout' })}>
          <LogIn className="mr-2 size-4" />
          Sign in with Google
        </Button>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Cart empty
  // -----------------------------------------------------------------------
  const items: CartItemDisplay[] = (cart?.items ?? []).map((item: any) => ({
    id: item.id ?? item._id,
    name: item.product?.name ?? 'Product',
    quantity: item.quantity,
    unitPrice: item.unitPrice ?? 0,
    variantName: item.variantName,
  }));

  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const shipping = cart?.shipping ?? 0;
  const total = subtotal + shipping;

  if (!cartLoading && items.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">Your cart is empty</h1>
        <p className="text-muted-foreground">
          Add some products before checking out.
        </p>
        <Button variant="outline" onClick={() => router.push('/shop/products')}>
          Browse Products
        </Button>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Submit handler
  // -----------------------------------------------------------------------
  async function handleSubmit(values: CheckoutFormValues) {
    setSubmitting(true);
    try {
      const result = await initiateCheckoutMutation.mutateAsync({
        organizationSlug: ORG_SLUG,
        shippingAddress: values.shippingAddress,
        notes: values.notes,
      } as any);

      const { orderNumber, paymentData } = result as any;

      // No snap token → order created but payment not initiated
      if (!paymentData?.snapToken) {
        toast.error('Payment initiation failed. Please try again.');
        router.push(`/shop/checkout/failed?order=${orderNumber}`);
        return;
      }

      // Open Midtrans Snap popup
      await payWithSnap(paymentData.snapToken as string, {
        onSuccess: () => {
          router.push(`/shop/checkout/success?order=${orderNumber}`);
        },
        onPending: () => {
          router.push(`/shop/checkout/pending?order=${orderNumber}`);
        },
        onClose: () => {
          // User closed the popup without completing
          router.push(`/shop/checkout/pending?order=${orderNumber}`);
        },
        onError: () => {
          router.push(`/shop/checkout/failed?order=${orderNumber}`);
        },
      });
    } catch (err: any) {
      toast.error(err?.message ?? 'Checkout failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  const defaultShipping = customerProfile
    ? {
        recipientName: customerProfile.name ?? '',
        phone: customerProfile.phone ?? '',
        address: customerProfile.address ?? '',
        city: customerProfile.city ?? '',
        postalCode: customerProfile.postalCode ?? '',
      }
    : undefined;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Checkout</h1>

      {cartLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <CheckoutForm
          cartItems={items}
          subtotal={subtotal}
          shipping={shipping}
          total={total}
          onSubmit={handleSubmit}
          loading={submitting}
          defaultValues={defaultShipping}
        />
      )}
    </div>
  );
}