'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Minus, Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatIDR } from '@/lib/commerce/format-currency';
import { usePublicMutation } from '@/lib/convex/hooks/convex-hooks';
import { api } from '@convex/_generated/api';
import { toast } from 'sonner';

export interface CartItemData {
  id: string;
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  product: {
    name: string;
    price?: number;
    imageUrl?: string;
    stock?: number;
  } | null;
}

interface CartItemRowProps {
  item: CartItemData;
  sessionId?: string;
  onUpdated?: () => void;
}

export function CartItemRow({ item, sessionId, onUpdated }: CartItemRowProps) {
  const [localQty, setLocalQty] = useState(item.quantity);
  const [removing, setRemoving] = useState(false);

  const updateQuantity = usePublicMutation(
    api.commerce.cart.updateQuantity as any,
    {
    onSuccess: () => {
      onUpdated?.();
    },
    onError: (err: any) => {
      toast.error(err?.data?.message ?? 'Failed to update quantity');
      setLocalQty(item.quantity);
    },
  });

  const removeItem = usePublicMutation(
    api.commerce.cart.removeItem as any,
    {
    onSuccess: () => {
      setRemoving(true);
      onUpdated?.();
    },
    onError: (err: any) => {
      toast.error(err?.data?.message ?? 'Failed to remove item');
      setRemoving(false);
    },
  });

  const handleDecrease = () => {
    if (localQty <= 1) return;
    const newQty = localQty - 1;
    setLocalQty(newQty);
    updateQuantity.mutate({
      cartItemId: item.id as any,
      quantity: newQty,
      sessionId: sessionId as any,
    } as any);
  };

  const handleIncrease = () => {
    const maxStock = item.product?.stock;
    if (maxStock !== undefined && maxStock !== null && localQty >= maxStock) {
      toast.error(`Only ${maxStock} available`);
      return;
    }
    const newQty = localQty + 1;
    setLocalQty(newQty);
    updateQuantity.mutate({
      cartItemId: item.id as any,
      quantity: newQty,
      sessionId: sessionId as any,
    } as any);
  };

  const handleRemove = () => {
    setRemoving(true);
    removeItem.mutate({
      cartItemId: item.id as any,
      sessionId: sessionId as any,
    } as any);
  };

  const lineTotal = localQty * item.unitPrice;
  const isUpdating = updateQuantity.isPending;

  if (removing && removeItem.isSuccess) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4 border-b py-4 sm:flex-row sm:items-center sm:gap-6">
      {/* Image */}
      <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-muted sm:h-28 sm:w-28">
        {item.product?.imageUrl ? (
          <Image
            src={item.product.imageUrl}
            alt={item.product.name}
            fill
            className="object-cover"
            sizes="112px"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            No image
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1">
        <h3 className="text-sm font-medium leading-tight">
          {item.product?.name ?? 'Unknown product'}
        </h3>
        {item.variantId && (
          <p className="text-xs text-muted-foreground">Variant: {item.variantId}</p>
        )}
        <p className="text-sm text-muted-foreground">
          {formatIDR(item.unitPrice)} each
        </p>
      </div>

      {/* Quantity */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={handleDecrease}
          disabled={localQty <= 1 || isUpdating}
        >
          {isUpdating ? <Loader2 className="size-3 animate-spin" /> : <Minus className="size-3" />}
        </Button>
        <span className="w-8 text-center text-sm font-medium">{localQty}</span>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={handleIncrease}
          disabled={isUpdating}
        >
          {isUpdating ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
        </Button>
      </div>

      {/* Line total */}
      <p className="text-sm font-bold sm:min-w-[100px] sm:text-right">
        {formatIDR(lineTotal)}
      </p>

      {/* Remove */}
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-destructive hover:bg-destructive/10"
        onClick={handleRemove}
        disabled={removing && removeItem.isPending}
      >
        {removing && removeItem.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Trash2 className="size-4" />
        )}
      </Button>
    </div>
  );
}