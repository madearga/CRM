'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthPaginatedQuery, useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ShoppingCart, Plus, Search } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { NoResults } from '@/components/no-results';
import { DataTable, DataTableSkeleton } from '@/components/data-table';
import { FloatingSelectionBar } from '@/components/floating-selection-bar';
import { getColumns, type SaleOrderRow } from './columns';
import { useSalesParams } from '@/hooks/use-sales-params';
import { useTableStore } from '@/store/table-store';
import { toast } from 'sonner';

export default function SalesPage() {
  const router = useRouter();
  const { q: search, archived: showArchived, setSearch, toggleArchived } = useSalesParams();
  const { selections, toggleOne, toggleAll, clearSelection } = useTableStore();
  const selectedIds = selections.sales ?? new Set();
  const [stateFilter, setStateFilter] = useState<string | undefined>(undefined);

  const { data: orders, isLoading } = useAuthPaginatedQuery(api.saleOrders.list, {
    search: search || undefined,
    includeArchived: showArchived,
    state: (stateFilter as any) || undefined,
  }, { initialNumItems: 50 });

  const archiveSO = useAuthMutation(api.saleOrders.archive);
  const unarchiveSO = useAuthMutation(api.saleOrders.unarchive);

  const rows: SaleOrderRow[] = useMemo(() =>
    (orders ?? []).map((so) => ({
      id: so.id,
      number: so.number,
      state: so.state,
      orderDate: so.orderDate,
      totalAmount: so.totalAmount,
      currency: so.currency,
      companyName: so.companyName,
      contactName: so.contactName,
      invoiceStatus: so.invoiceStatus,
      archivedAt: so.archivedAt,
    })),
    [orders],
  );

  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const toggleOneSO = useCallback((id: string) => toggleOne("sales", id), [toggleOne]);
  const toggleAllSO = useCallback(() => toggleAll("sales", allIds), [toggleAll, allIds]);

  const columns = useMemo(
    () => getColumns({ selectedIds, toggleOne: toggleOneSO, allIds, toggleAll: toggleAllSO }),
    [selectedIds, toggleOneSO, allIds, toggleAllSO],
  );

  const handleBulkArchive = async () => {
    const ids = [...selectedIds];
    const results = await Promise.allSettled(ids.map((id) => archiveSO.mutateAsync({ id: id as any })));
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed === 0) toast.success(`${ids.length} archived`);
    else toast.error(`Archived ${ids.length - failed}/${ids.length}. ${failed} failed.`);
    clearSelection("sales");
  };

  const handleBulkRestore = async () => {
    const ids = [...selectedIds];
    const results = await Promise.allSettled(ids.map((id) => unarchiveSO.mutateAsync({ id: id as any })));
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed === 0) toast.success(`${ids.length} restored`);
    else toast.error(`Restored ${ids.length - failed}/${ids.length}. ${failed} failed.`);
    clearSelection("sales");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" onClick={() => router.push('/sales/new')}>
          <Plus className="mr-1 h-4 w-4" />New Quotation
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search orders..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={stateFilter ?? "__all__"} onValueChange={(v) => setStateFilter(v === "__all__" ? undefined : v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="invoiced">Invoiced</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="done">Done</SelectItem>
            <SelectItem value="cancel">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Button variant={showArchived ? 'default' : 'outline'} size="sm" onClick={toggleArchived}>
          {showArchived ? 'Hide Archived' : 'Show Archived'}
        </Button>
      </div>

      {isLoading ? (
        <DataTableSkeleton columns={[
          { type: "checkbox" }, { type: "avatar-text", width: "w-32" },
          { type: "badge" }, { type: "text", width: "w-24" },
          { type: "text", width: "w-20" }, { type: "text", width: "w-20" },
          { type: "icon" },
        ]} />
      ) : search && !rows.length ? (
        <NoResults searchQuery={search} onClear={() => setSearch('')} />
      ) : !rows.length ? (
        <EmptyState
          icon={<ShoppingCart className="size-7" />} title="No sale orders yet"
          description="Create your first quotation to start selling."
          action={<Button variant="outline" size="sm" onClick={() => router.push('/sales/new')}><Plus className="mr-1 h-4 w-4" />Create Quotation</Button>}
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          onRowClick={(row) => router.push(`/sales/${row.id}`)}
          rowClassName={(row) => `${row.archivedAt ? 'opacity-60' : ''} ${selectedIds.has(row.id) ? 'bg-muted/30' : ''}`}
        />
      )}

      <FloatingSelectionBar
        count={selectedIds.size}
        onClear={() => clearSelection("sales")}
        onArchive={handleBulkArchive}
        onRestore={handleBulkRestore}
        showRestore={showArchived}
        isArchiving={archiveSO.isPending}
      />
    </div>
  );
}
