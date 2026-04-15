'use client';

import { useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import { useConvexMutation } from '@convex-dev/react-query';
import { api } from '@convex/_generated/api';

interface AddToCartButtonProps {
  productId: string;
  variantId?: string;
  organizationSlug: string;
  disabled?: boolean;
  onSuccess?: () => void;
  sessionId?: string;
}

const SESSION_KEY = 'shop_session_id';

function getSessionId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return localStorage.getItem(SESSION_KEY) ?? undefined;
}

export function AddToCartButton({
  productId,
  variantId,
  organizationSlug,
  disabled = false,
  onSuccess,
  sessionId,
}: AddToCartButtonProps) {
  const addItem = useMutation({
    mutationFn: useConvexMutation(
      api.commerce.cart.addItem as any
    ),
  });

  const effectiveSessionId = sessionId ?? getSessionId();

  const handleClick = () => {
    addItem
      .mutateAsync({
        organizationSlug,
        productId: productId as any,
        variantId: variantId as any,
        quantity: 1,
        sessionId: effectiveSessionId,
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