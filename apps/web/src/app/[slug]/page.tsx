'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { ArrowRight, Truck, Shield, RefreshCw } from 'lucide-react';

import { api } from '@convex/_generated/api';
import { usePublicQuery, usePublicPaginatedQuery } from '@/lib/convex/hooks';
import { formatIDR } from '@/lib/commerce/format-currency';
import { ProductGrid, type ProductCardData } from '@/components/shop/product-grid';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function ShopHomePage() {
  const { slug } = useParams<{ slug: string }>();
  // Featured products (top 8)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: featuredResult, isLoading: featuredLoading } = usePublicPaginatedQuery(
    api.commerce.products.listPublished,
    { organizationSlug: slug },
    { initialNumItems: 8 }
  ) as any;

  // Categories
  const { data: categories, isLoading: catLoading } = usePublicQuery(
    api.commerce.products.listCategories,
    { organizationSlug: slug }
  );

  const featuredProducts: ProductCardData[] = useMemo(
    () =>
      (featuredResult?.data ?? []).map((p) => ({
        _id: p.id,
        name: p.name,
        slug: p.slug ?? '',
        price: p.price ?? 0,
        imageUrl: p.imageUrl,
        stock: p.stock,
        category: p.categoryName,
        organizationSlug: slug,
      })),
    [featuredResult?.data]
  );

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-background to-primary/5 px-4 py-16 text-center md:py-24">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            Welcome to Our Store
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Quality products, great prices — discover what we have for you.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href={`/${slug}/products`}>
                Browse Products <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="#categories">Shop by Category</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="mx-auto w-full max-w-7xl px-4 py-12 md:px-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Featured Products</h2>
          <Link
            href={`/${slug}/products`}
            className="text-sm font-medium text-primary hover:underline"
          >
            View all <ArrowRight className="inline size-3" />
          </Link>
        </div>
        <div className="mt-6">
          <ProductGrid products={featuredProducts} loading={featuredLoading} />
        </div>
      </section>

      {/* Categories */}
      <section
        id="categories"
        className="bg-muted/40 px-4 py-12 md:px-6"
      >
        <div className="mx-auto max-w-7xl">
          <h2 className="text-2xl font-bold">Shop by Category</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {catLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-24 animate-pulse rounded-lg bg-muted"
                  />
                ))
              : (categories ?? []).map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/${slug}/products?category=${cat.id}`}
                    className="group flex flex-col items-center justify-center rounded-lg border bg-background p-6 transition-shadow hover:shadow-md"
                  >
                    <span className="text-base font-semibold group-hover:text-primary">
                      {cat.name}
                    </span>
                    <Badge variant="secondary" className="mt-2">
                      {cat.productCount} product{cat.productCount !== 1 ? 's' : ''}
                    </Badge>
                  </Link>
                ))}
          </div>
        </div>
      </section>

      {/* Promo Banner */}
      <section className="mx-auto w-full max-w-7xl px-4 py-12 md:px-6">
        <div className="overflow-hidden rounded-xl bg-primary px-6 py-10 text-center text-primary-foreground md:py-14">
          <h2 className="text-2xl font-bold md:text-3xl">
            🚚 Free Shipping on Orders Over {formatIDR(500_000)}
          </h2>
          <p className="mt-2 text-primary-foreground/80">
            Shop now and save on delivery!
          </p>
          <Button asChild variant="secondary" size="lg" className="mt-6">
            <Link href={`/${slug}/products`}>Shop Now</Link>
          </Button>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="border-t px-4 py-10 md:px-6">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 sm:grid-cols-3">
          {[
            { icon: Truck, title: 'Fast Delivery', desc: 'Nationwide shipping' },
            { icon: Shield, title: 'Secure Payment', desc: '100% protected' },
            { icon: RefreshCw, title: 'Easy Returns', desc: '30-day return policy' },
          ].map((item) => (
            <div key={item.title} className="flex flex-col items-center text-center">
              <item.icon className="size-8 text-primary" />
              <h3 className="mt-2 font-semibold">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}