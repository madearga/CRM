'use client';

import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface CartIconProps {
  itemCount?: number;
}

export function CartIcon({ itemCount = 0 }: CartIconProps) {
  return (
    <Link href="/shop/cart" className="relative inline-flex items-center">
      <ShoppingCart className="size-5" />
      {itemCount > 0 && (
        <Badge
          variant="destructive"
          className="absolute -right-2 -top-2 flex size-5 items-center justify-center p-0 text-[10px] font-bold"
        >
          {itemCount > 99 ? '99+' : itemCount}
        </Badge>
      )}
    </Link>
  );
}
