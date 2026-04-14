'use client';

import { useCallback, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { SlidersHorizontal, X } from 'lucide-react';

import { api } from '@convex/_generated/api';
import { usePublicPaginatedQuery, usePublicQuery } from '@/lib/convex/hooks';
import { formatIDR } from '@/lib/commerce/format-currency';
import { ProductGrid, type ProductCardData } from '@/components/shop/product-grid';
import { ProductFilters } from '@/components/shop/product-filters';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';

const ORG_SLUG = 'default';

type SortOption = 'newest' | 'price-asc' | 'price-desc';

export default function ProductsCatalogPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q') ?? '';
  const categoryId = searchParams.get('category') ?? '';

  const [sort, setSort] = useState<SortOption>('newest');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Products
  const {
    data: productsRaw,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePublicPaginatedQuery(
    api.commerce.products.listPublished,
    {
      organizationSlug: ORG_SLUG,
      ...(categoryId ? { category: categoryId as any } : {}),
      ...(searchQuery ? { search: searchQuery } : {}),
    },
    { initialNumItems: 12 }
  );

  // Categories for filter
  const { data: categories } = usePublicQuery(
    api.commerce.products.listCategories,
    { organizationSlug: ORG_SLUG }
  );

  const products: ProductCardData[] = useMemo(() => {
    let items = (productsRaw ?? []).map((p) => ({
      _id: p.id,
      name: p.name,
      slug: p.slug ?? '',
      price: p.price ?? 0,
      imageUrl: p.imageUrl,
      stock: p.stock,
      category: p.categoryName,
      organizationSlug: ORG_SLUG,
    }));

    if (sort === 'price-asc') {
      items = [...items].sort((a, b) => a.price - b.price);
    } else if (sort === 'price-desc') {
      items = [...items].sort((a, b) => b.price - a.price);
    }

    return items;
  }, [productsRaw, sort]);

  const handleCategoryChange = useCallback(
    (catId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (catId) {
        params.set('category', catId);
      } else {
        params.delete('category');
      }
      router.push(`/shop/products?${params.toString()}`);
    },
    [searchParams, router]
  );

  const handleSearch = useCallback(
    (q: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (q) {
        params.set('q', q);
      } else {
        params.delete('q');
      }
      router.push(`/shop/products?${params.toString()}`);
    },
    [searchParams, router]
  );

  const clearFilters = useCallback(() => {
    router.push('/shop/products');
  }, [router]);

  const activeFilterCount = [categoryId, searchQuery].filter(Boolean).length;

  const filterContent = (
    <ProductFilters
      categories={categories ?? []}
      selectedCategory={categoryId}
      onCategoryChange={handleCategoryChange}
      searchQuery={searchQuery}
      onSearchChange={handleSearch}
      onClear={clearFilters}
    />
  );

  return (
    <div className="mx-auto flex max-w-7xl gap-8 px-4 py-8 md:px-6">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 md:block">
        {filterContent}
      </aside>

      {/* Main content */}
      <div className="flex-1">
        {/* Toolbar */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {/* Mobile filters */}
            <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="md:hidden">
                  <SlidersHorizontal className="mr-2 size-4" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="ml-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="mt-4">{filterContent}</div>
              </SheetContent>
            </Sheet>

            <h1 className="text-xl font-bold md:text-2xl">Products</h1>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground"
              >
                <X className="mr-1 size-3" />
                Clear
              </Button>
            )}
          </div>

          <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="price-asc">Price: Low → High</SelectItem>
              <SelectItem value="price-desc">Price: High → Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Product Grid */}
        <ProductGrid products={products} loading={isLoading} />

        {/* Load More */}
        {hasNextPage && (
          <div className="mt-8 flex justify-center">
            <Button
              variant="outline"
              onClick={fetchNextPage}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? 'Loading more...' : 'Load More'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}