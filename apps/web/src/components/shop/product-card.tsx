'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatIDR } from '@/lib/commerce/format-currency';
import { AddToCartButton } from '@/components/shop/add-to-cart-button';

export interface ProductCardData {
  name: string;
  imageUrl?: string;
  price: number;
  slug: string;
  _id: string;
  stock?: number;
  category?: string;
  organizationSlug: string;
}

interface ProductCardProps {
  product: ProductCardData;
}

export function ProductCard({ product }: ProductCardProps) {
  const outOfStock = product.stock !== undefined && product.stock !== null && product.stock <= 0;

  return (
    <Card className="group overflow-hidden transition-shadow hover:shadow-lg">
      <Link href={`/shop/products/${product.slug}`}>
        <div className="relative aspect-square overflow-hidden bg-muted">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              className="object-cover transition-transform group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              No image
            </div>
          )}
          {outOfStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-bold text-white">
              Out of Stock
            </div>
          )}
        </div>
      </Link>

      <CardContent className="p-3">
        {product.category && (
          <Badge variant="secondary" className="mb-1.5 text-[10px]">
            {product.category}
          </Badge>
        )}
        <Link href={`/shop/products/${product.slug}`}>
          <h3 className="line-clamp-2 text-sm font-medium leading-tight hover:underline">
            {product.name}
          </h3>
        </Link>
        <p className="mt-1 text-sm font-bold">{formatIDR(product.price)}</p>
      </CardContent>

      <CardFooter className="px-3 pb-3 pt-0">
        <AddToCartButton
          productId={product._id}
          organizationSlug={product.organizationSlug}
          disabled={outOfStock}
        />
      </CardFooter>
    </Card>
  );
}
