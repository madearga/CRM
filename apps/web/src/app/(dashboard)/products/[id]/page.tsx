'use client';

import { useAuthQuery, useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, Package, Archive, RotateCcw, Pencil, Copy, Tag,
} from 'lucide-react';
import { toast } from 'sonner';
import { useParams, useRouter } from 'next/navigation';
import { VariantManager } from '@/components/products/variant-manager';
import { ProductForm } from '@/components/products/product-form';

const TYPE_COLORS: Record<string, string> = {
  storable: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  consumable: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  service: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: product, isLoading } = useAuthQuery(api.products.getById, { id: id as any });
  const archiveProduct = useAuthMutation(api.products.archive);
  const unarchiveProduct = useAuthMutation(api.products.unarchive);
  const duplicateProduct = useAuthMutation(api.products.duplicate);

  const handleArchive = async () => {
    try {
      await archiveProduct.mutateAsync({ id: id as any });
      toast.success('Product archived');
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to archive');
    }
  };

  const handleRestore = async () => {
    try {
      await unarchiveProduct.mutateAsync({ id: id as any });
      toast.success('Product restored');
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to restore');
    }
  };

  const handleDuplicate = async () => {
    try {
      const newId = await duplicateProduct.mutateAsync({ id: id as any });
      toast.success('Product duplicated');
      router.push(`/products/${newId}`);
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to duplicate');
    }
  };

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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/products')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
              <Package className="size-4" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{product.name}</h2>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className={TYPE_COLORS[product.type] ?? ''}>
                  {product.type}
                </Badge>
                {product.sku && (
                  <span className="text-xs text-muted-foreground">SKU: {product.sku}</span>
                )}
                {product.archivedAt && (
                  <Badge variant="secondary" className="bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400">
                    Archived
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDuplicate}>
            <Copy className="mr-1 h-4 w-4" />Duplicate
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push(`/products/${id}/edit`)}>
            <Pencil className="mr-1 h-4 w-4" />Edit
          </Button>
          {product.archivedAt ? (
            <Button variant="outline" size="sm" onClick={handleRestore}>
              <RotateCcw className="mr-1 h-4 w-4" />Restore
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handleArchive}>
              <Archive className="mr-1 h-4 w-4" />Archive
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Info</TabsTrigger>
          <TabsTrigger value="variants">Variants ({product.variants.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Details Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-wider">Product Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <DetailRow label="Category" value={product.category} />
                <DetailRow label="Barcode" value={product.barcode} />
                <DetailRow label="Unit" value={product.unit} />
                <DetailRow label="Weight" value={product.weight != null ? `${product.weight} kg` : undefined} />
                <DetailRow label="Description" value={product.description} />
                <DetailRow label="Notes" value={product.notes} />
              </CardContent>
            </Card>

            {/* Pricing Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-wider">Pricing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <DetailRow label="Sale Price" value={product.price != null ? `Rp ${product.price.toLocaleString('id-ID')}` : undefined} />
                <DetailRow label="Cost Price" value={product.cost != null ? `Rp ${product.cost.toLocaleString('id-ID')}` : undefined} />
                {product.price != null && product.cost != null && (
                  <DetailRow
                    label="Margin"
                    value={`Rp ${(product.price - product.cost).toLocaleString('id-ID')} (${Math.round(((product.price - product.cost) / product.price) * 100)}%)`}
                  />
                )}
              </CardContent>
            </Card>

            {/* Tags */}
            {product.tags && product.tags.length > 0 && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-sm uppercase tracking-wider">Tags</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {product.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        <Tag className="mr-1 h-3 w-3" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="variants" className="mt-4">
          <VariantManager
            productId={id}
            variants={product.variants}
            basePrice={product.price}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value ?? '—'}</span>
    </div>
  );
}
