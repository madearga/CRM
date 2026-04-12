'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthPaginatedQuery, useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Package, Plus, Search, Download, Upload } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { NoResults } from '@/components/no-results';
import { DataTable, DataTableSkeleton } from '@/components/data-table';
import { FloatingSelectionBar } from '@/components/floating-selection-bar';
import { getColumns, type ProductRow } from './columns';
import { useProductsParams } from '@/hooks/use-products-params';
import { useTableStore } from '@/store/table-store';
import { toast } from 'sonner';
import { productsToCSV, downloadCSV, parseCSV } from '@/components/products/csv-utils';

export default function ProductsPage() {
  const router = useRouter();
  const { q: search, archived: showArchived, setSearch, toggleArchived } = useProductsParams();
  const { selections, toggleOne, toggleAll, clearSelection } = useTableStore();
  const selectedIds = useMemo(() => selections.products ?? new Set(), [selections.products]);
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);

  const { data: products, isLoading } = useAuthPaginatedQuery(api.products.list, {
    search: search || undefined,
    includeArchived: showArchived,
    type: (typeFilter as any) || undefined,
  }, { initialNumItems: 50 });

  const archiveProduct = useAuthMutation(api.products.archive);
  const unarchiveProduct = useAuthMutation(api.products.unarchive);
  const createProduct = useAuthMutation(api.products.create);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const rows: ProductRow[] = useMemo(() =>
    (products ?? []).map((p) => ({
      id: p.id, name: p.name, type: p.type,
      category: p.category,
      categoryName: p.categoryName,
      sku: p.sku, price: p.price, cost: p.cost, unit: p.unit,
      active: p.active, archivedAt: p.archivedAt,
    })),
    [products],
  );

  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);

  const toggleOneProduct = useCallback((id: string) => toggleOne("products", id), [toggleOne]);
  const toggleAllProducts = useCallback(() => toggleAll("products", allIds), [toggleAll, allIds]);

  const columns = useMemo(
    () => getColumns({
      selectedIds,
      toggleOne: toggleOneProduct,
      allIds,
      toggleAll: toggleAllProducts,
    }),
    [selectedIds, toggleOneProduct, allIds, toggleAllProducts],
  );

  const handleExport = () => {
    const csv = productsToCSV(rows.map((r) => ({
      name: r.name,
      type: r.type,
      category: r.categoryName ?? undefined,
      sku: r.sku ?? undefined,
      price: r.price ?? undefined,
      cost: r.cost ?? undefined,
      unit: r.unit ?? undefined,
      active: r.active ?? true,
    })));
    downloadCSV(csv, `products-${new Date().toISOString().slice(0, 10)}.csv`);
    toast.success(`Exported ${rows.length} products`);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const csvRows = parseCSV(text);
      const validTypes = ['storable', 'consumable', 'service'];
      let created = 0;
      const failed: { row: number; reason: string }[] = [];
      const total = csvRows.length;

      for (let i = 0; i < csvRows.length; i++) {
        const row = csvRows[i];
        const name = row.name?.trim();
        if (!name) {
          failed.push({ row: i + 2, reason: 'Missing name' });
          continue;
        }
        const type = validTypes.includes(row.type?.trim()?.toLowerCase()) ? row.type.trim().toLowerCase() : 'storable';

        // Validate numeric fields
        const parseNum = (val: string | undefined): number | undefined => {
          if (!val?.trim()) return undefined;
          const n = Number(val.trim());
          if (isNaN(n) || !isFinite(n) || n < 0 || n > Number.MAX_SAFE_INTEGER) return undefined;
          return n;
        };

        try {
          await createProduct.mutateAsync({
            name,
            type: type as any,
            // Note: CSV category is a name string; category field now expects an ID.
            // Users importing with categories should create categories first, then import.
            sku: row.sku?.trim() || undefined,
            barcode: row.barcode?.trim() || undefined,
            price: parseNum(row.price),
            cost: parseNum(row.cost),
            unit: row.unit?.trim() || undefined,
            description: row.description?.trim() || undefined,
            tags: row.tags?.trim() ? row.tags.split(';').map((t) => t.trim()).filter(Boolean) : undefined,
          });
          created++;
        } catch (err: any) {
          failed.push({ row: i + 2, reason: err?.data?.message ?? 'Unknown error' });
        }

        // Show progress every 10 items or at the end
        if ((created + failed.length) % 10 === 0 || i === csvRows.length - 1) {
          toast.info(`Importing... ${created + failed.length}/${total}`);
        }
      }

      const summary = `Imported ${created}/${total} products`;
      if (failed.length > 0) {
        toast.warning(`${summary}. ${failed.length} failed.`, {
          description: failed.slice(0, 5).map((f) => `Row ${f.row}: ${f.reason}`).join('\n'),
          duration: 8000,
        });
      } else {
        toast.success(summary);
      }
    } catch (err: any) {
      toast.error('Failed to import CSV');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleBulkArchive = async () => {
    const ids = [...selectedIds];
    const results = await Promise.allSettled(ids.map((id) => archiveProduct.mutateAsync({ id: id as any })));
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed === 0) toast.success(`${ids.length} ${ids.length === 1 ? 'product' : 'products'} archived`);
    else toast.error(`Archived ${ids.length - failed}/${ids.length}. ${failed} failed.`);
    clearSelection("products");
  };

  const handleBulkRestore = async () => {
    const ids = [...selectedIds];
    const results = await Promise.allSettled(ids.map((id) => unarchiveProduct.mutateAsync({ id: id as any })));
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed === 0) toast.success(`${ids.length} ${ids.length === 1 ? 'product' : 'products'} restored`);
    else toast.error(`Restored ${ids.length - failed}/${ids.length}. ${failed} failed.`);
    clearSelection("products");
  };

  return (
    <div className="space-y-4">
      {/* Header + Add */}
      <div className="flex items-center justify-end gap-2">
        <input
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleImport}
          ref={fileInputRef}
        />
        <Button variant="outline" size="sm" onClick={handleExport} disabled={!rows.length}>
          <Download className="mr-1 h-4 w-4" />Export
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing}>
          <Upload className="mr-1 h-4 w-4" />{importing ? 'Importing...' : 'Import'}
        </Button>
        <Button size="sm" onClick={() => router.push('/products/new')}>
          <Plus className="mr-1 h-4 w-4" />Add Product
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search products..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter ?? "__all__"} onValueChange={(v) => setTypeFilter(v === "__all__" ? undefined : v)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All types</SelectItem>
            <SelectItem value="storable">Storable</SelectItem>
            <SelectItem value="consumable">Consumable</SelectItem>
            <SelectItem value="service">Service</SelectItem>
          </SelectContent>
        </Select>
        <Button variant={showArchived ? 'default' : 'outline'} size="sm" onClick={toggleArchived}>
          {showArchived ? 'Hide Archived' : 'Show Archived'}
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <DataTableSkeleton columns={[
          { type: "checkbox" }, { type: "avatar-text", width: "w-32" },
          { type: "badge" }, { type: "text", width: "w-20" },
          { type: "text", width: "w-16" }, { type: "text", width: "w-16" },
          { type: "text", width: "w-12" }, { type: "icon" },
        ]} />
      ) : search && !rows.length ? (
        <NoResults searchQuery={search} onClear={() => setSearch('')} />
      ) : !rows.length ? (
        <EmptyState
          icon={<Package className="size-7" />} title="No products yet"
          description="Add your first product to start building your product catalog."
          action={<Button variant="outline" size="sm" onClick={() => router.push('/products/new')}><Plus className="mr-1 h-4 w-4" />Add your first product</Button>}
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          onRowClick={(row) => router.push(`/products/${row.id}`)}
          rowClassName={(row) => `${row.archivedAt ? 'opacity-60' : ''} ${selectedIds.has(row.id) ? 'bg-muted/30' : ''}`}
        />
      )}

      {/* Floating Selection Bar */}
      <FloatingSelectionBar
        count={selectedIds.size}
        onClear={() => clearSelection("products")}
        onArchive={handleBulkArchive}
        onRestore={handleBulkRestore}
        showRestore={showArchived}
        isArchiving={archiveProduct.isPending}
      />
    </div>
  );
}
