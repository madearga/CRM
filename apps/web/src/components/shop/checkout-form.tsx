'use client';

import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Loader2 } from 'lucide-react';
import { formatIDR } from '@/lib/commerce/format-currency';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CartItemDisplay {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  variantName?: string;
}

export interface ShippingAddress {
  recipientName: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
}

export interface CheckoutFormValues {
  shippingAddress: ShippingAddress;
  notes: string;
}

interface CheckoutFormProps {
  cartItems: CartItemDisplay[];
  subtotal: number;
  shipping: number;
  total: number;
  onSubmit: (values: CheckoutFormValues) => void;
  loading: boolean;
  defaultValues?: Partial<ShippingAddress>;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const shippingSchema = z.object({
  recipientName: z.string().min(1, 'Recipient name is required'),
  phone: z.string().min(8, 'Phone number must be at least 8 characters'),
  address: z.string().min(5, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  postalCode: z.string().min(4, 'Postal code must be at least 4 characters'),
});

const checkoutSchema = z.object({
  shippingAddress: shippingSchema,
  notes: z.string().optional().default(''),
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CheckoutForm({
  cartItems,
  subtotal,
  shipping,
  total,
  onSubmit,
  loading,
  defaultValues,
}: CheckoutFormProps) {
  const form = useForm<CheckoutFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(checkoutSchema) as any,
    defaultValues: {
      shippingAddress: {
        recipientName: defaultValues?.recipientName ?? '',
        phone: defaultValues?.phone ?? '',
        address: defaultValues?.address ?? '',
        city: defaultValues?.city ?? '',
        postalCode: defaultValues?.postalCode ?? '',
      },
      notes: '',
    },
  });

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      {/* Shipping Form */}
      <div className="lg:col-span-2">
        <Form {...form}>
          <form
            id="checkout-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold">Shipping Address</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="shippingAddress.recipientName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recipient Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="shippingAddress.phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="08123456789" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="shippingAddress.address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input placeholder="Jl. Example No. 123" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="shippingAddress.city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input placeholder="Jakarta" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="shippingAddress.postalCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postal Code</FormLabel>
                    <FormControl>
                      <Input placeholder="12345" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Order Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any special instructions..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </div>

      {/* Order Summary */}
      <div className="lg:col-span-1">
        {/* Desktop: sidebar card */}
        <div className="hidden lg:block rounded-lg border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">Order Summary</h2>

          <div className="space-y-3">
            {cartItems.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <div className="flex-1 min-w-0">
                  <span className="truncate">{item.name}</span>
                  {item.variantName && (
                    <span className="text-muted-foreground">
                      {' '}({item.variantName})
                    </span>
                  )}
                  <span className="text-muted-foreground"> × {item.quantity}</span>
                </div>
                <span className="font-medium ml-2">
                  {formatIDR(item.unitPrice * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          <Separator />

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatIDR(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span>{shipping === 0 ? 'Free' : formatIDR(shipping)}</span>
            </div>
          </div>

          <Separator />

          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatIDR(total)}</span>
          </div>

          <Button
            type="submit"
            form="checkout-form"
            className="w-full"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Pay with Midtrans'
            )}
          </Button>
        </div>

        {/* Mobile: sticky bottom bar */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur p-4 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">{cartItems.length} item{cartItems.length !== 1 ? 's' : ''}</p>
              <p className="text-lg font-bold">{formatIDR(total)}</p>
            </div>
            <Button
              type="submit"
              form="checkout-form"
              size="lg"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Pay Now'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}