'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, notFound } from 'next/navigation';
import { Minus, Plus, ShoppingCart, ChevronRight } from 'lucide-react';

import { api } from '@convex/_generated/api';
import { usePublicQuery, usePublicPaginatedQuery } from '@/lib/convex/hooks';
import { formatIDR } from '@/lib/commerce/format-currency';
import { AddToCartButton } from '@/components/shop/add-to-cart-button';
import { ProductGrid, type ProductCardData } from '@/components/shop/product-grid';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import { ProductImageGallery } from '@/components/shop/product-image-gallery';

const ORG_SLUG = 'default';

export default function ProductDetailPage() {
  const params = useParams<{ slug: string }>();
  const [quantity, setQuantity] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(undefined);

  // Fetch product by slug
  const { data: product, isLoading, isError } = usePublicQuery(
    api.commerce.products.getBySlug,
    { organizationSlug: ORG_SLUG, slug: params.slug }
  );

  // Related products (same category)
  const { data: relatedRaw, isLoading: relatedLoading } = usePublicPaginatedQuery(
    api.commerce.products.listPublished,
    product?.category
      ? { organizationSlug: ORG_SLUG, category: product.category as any }
      : 'skip',
    { initialNumItems: 4 }
  );

  const images = useMemo(() => {
    if (!product) return [];
    if (product.images && product.images.length > 0) {
      return product.images as string[];
    }
    if (product.imageUrl) return [product.imageUrl];
    return [];
  }, [product]);

  const inStock = product?.stock === undefined || product?.stock === null || product.stock > 0;

  const relatedProducts: ProductCardData[] = useMemo(
    () =>
      (relatedRaw?.data ?? [])
        .filter((p) => p.slug !== params.slug)
        .slice(0, 4)
        .map((p) => ({
          _id: p.id,
          name: p.name,
          slug: p.slug ?? '',
          price: p.price ?? 0,
          imageUrl: p.imageUrl,
          stock: p.stock,
          category: p.categoryName,
          organizationSlug: ORG_SLUG,
        })),
    [relatedRaw, params.slug]
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="aspect-square animate-pulse rounded-lg bg-muted" />
          <div className="space-y-4">
            <div className="h-6 w-24 animate-pulse rounded bg-muted" />
            <div className="h-8 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-6 w-32 animate-pulse rounded bg-muted" />
            <div className="mt-8 space-y-2">
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
              <div className="h-4 w-4/6 animate-pulse rounded bg-muted" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product || isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h1 className="text-2xl font-bold">Product Not Found</h1>
        <p className="mt-2 text-muted-foreground">
          The product you&apos;re looking for doesn&apos;t exist or has been removed.
        </p>
        <Button asChild className="mt-4">
          <Link href="/shop/products">Back to Products</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      {/* Breadcrumb */}
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/shop">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/shop/products">Products</BreadcrumbLink>
          </BreadcrumbItem>
          {product.categoryName && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink
                  href={`/shop/products?category=${product.category}`}
                >
                  {product.categoryName}
                </BreadcrumbLink>
              </BreadcrumbItem>
            </>
          )}
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <span className="font-medium text-foreground">{product.name}</span>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Image gallery */}
        <ProductImageGallery images={images} name={product.name} />

        {/* Product info */}
        <div className="flex flex-col">
          {product.categoryName && (
            <Badge variant="secondary" className="mb-2 w-fit">
              {product.categoryName}
            </Badge>
          )}

          <h1 className="text-2xl font-bold md:text-3xl">{product.name}</h1>

          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-3xl font-bold text-primary">
              {formatIDR(product.price ?? 0)}
            </span>
          </div>

          {/* Stock status */}
          <div className="mt-4">
            {inStock ? (
              <Badge variant="default" className="bg-green-600 text-white">
                In Stock
                {product.stock != null && ` (${product.stock} available)`}
              </Badge>
            ) : (
              <Badge variant="destructive">Out of Stock</Badge>
            )}
          </div>

          {/* Variants */}
          {product.variants && product.variants.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-semibold">Variants</h3>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((variant) => (
                  <Button
                    key={variant.id}
                    variant={selectedVariantId === variant.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedVariantId(variant.id)}
                  >
                    {variant.name}
                    {variant.priceExtra ? ` (+${formatIDR(variant.priceExtra)})` : ''}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-semibold">Quantity</h3>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
              >
                <Minus className="size-4" />
              </Button>
              <span className="w-10 text-center font-medium">{quantity}</span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQuantity((q) => q + 1)}
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </div>

          {/* Add to Cart */}
          <div className="mt-6">
            {product.variants && product.variants.length > 0 && !selectedVariantId ? (
              <Button className="w-full" size="lg" disabled>
                Select a variant
              </Button>
            ) : (
              <AddToCartButton
                productId={product.id}
                variantId={selectedVariantId}
                organizationSlug={ORG_SLUG}
                disabled={!inStock}
              />
            )}
          </div>

          <Separator className="my-6" />

          {/* Description */}
          {product.description && (
            <div className="prose prose-sm max-w-none text-muted-foreground">
              <h3 className="text-sm font-semibold text-foreground">Description</h3>
              <p className="mt-2 whitespace-pre-line">{product.description}</p>
            </div>
          )}

          {/* Tags */}
          {product.tags && product.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {product.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 text-xl font-bold">Related Products</h2>
          <ProductGrid products={relatedProducts} loading={relatedLoading} />
        </section>
      )}
    </div>
  );
}