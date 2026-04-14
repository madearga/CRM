'use client';

import { useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { FunctionReference } from 'convex/server';
import { useMutation } from '@tanstack/react-query';
import { useConvexMutation } from '@convex-dev/react-query';

interface AddToCartButtonProps {
  productId: string;
  variantId?: string;
  organizationSlug: string;
  disabled?: boolean;
  onSuccess?: () => void;
}

export function AddToCartButton({
  productId,
  variantId,
  organizationSlug,
  disabled = false,
  onSuccess,
}: AddToCartButtonProps) {
  const addItem = useMutation({
    mutationFn: useConvexMutation(
      'commerce/cart:addItem' as unknown as FunctionReference<'mutation', 'public', any, any>
    ) as any,
  });

  const handleClick = () => {
    addItem
      .mutateAsync({
        organizationSlug,
        productId: productId as any,
        variantId: variantId as any,
        quantity: 1,
      } as any)
      .then(() => {
        toast.success('Added to cart');
        onSuccess?.();
      })
      .catch((err: any) => {
        toast.error(err?.message ?? 'Failed to add item');
      });
  };

  return (
    <Button
      onClick={handleClick}
      disabled={disabled || addItem.isPending}
      className="w-full"
      size="sm"
    >
      {addItem.isPending ? (
        <Loader2 className="mr-2 size-4 animate-spin" />
      ) : (
        <Plus className="mr-2 size-4" />
      )}
      {disabled ? 'Out of Stock' : 'Add to Cart'}
    </Button>
  );
}