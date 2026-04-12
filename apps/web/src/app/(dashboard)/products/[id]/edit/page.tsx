'use client';

import { useAuthQuery } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Package } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { ProductForm } from '@/components/products/product-form';

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: product, isLoading } = useAuthQuery(api.products.getById, { id: id as any });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Package className="h-12 w-12 text-muted-foreground/50" />
        <p className="mt-3 text-muted-foreground">Product not found</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => router.push('/products')}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Products
        </Button>
      </div>
    );
  }

  return (
    <ProductForm
      productId={id}
      initialData={{
        name: product.name,
        type: product.type,
        description: product.description,
        category: product.category,
        imageUrl: product.imageUrl,
        cost: product.cost,
        price: product.price,
        unit: product.unit,
        sku: product.sku,
        barcode: product.barcode,
        weight: product.weight,
        tags: product.tags,
        notes: product.notes,
      }}
    />
  );
}
