'use client';

import { useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthPaginatedQuery, useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { RefreshCw, Plus, Search } from 'lucide-react';
import { DataTableExportButton } from '@/components/data-table-export-button';
import { EmptyState } from '@/components/empty-state';
import { NoResults } from '@/components/no-results';
import { DataTable, DataTableSkeleton } from '@/components/data-table';
import { FloatingSelectionBar } from '@/components/floating-selection-bar';
import { getColumns, type SubscriptionRow } from './columns';
import { useSubscriptionsParams } from '@/hooks/use-subscriptions-params';
import { useTableStore } from '@/store/table-store';
import { toast } from 'sonner';

export default function SubscriptionsPage() {
  const router = useRouter();
  const {
    q: search,
    archived: showArchived,
    state: stateFilter,
    setSearch,
    toggleArchived,
    setState: setStateFilter,
  } = useSubscriptionsParams();
  const { selections, toggleOne, toggleAll, clearSelection } = useTableStore();

  const { data: subscriptions, isLoading } = useAuthPaginatedQuery(api.subscriptions.list, {
    search: search || undefined,
    includeArchived: showArchived,
    state: (stateFilter as any) || undefined,
  }, { initialNumItems: 50 });

  const archiveSub = useAuthMutation(api.subscriptions.archive);
  const unarchiveSub = useAuthMutation(api.subscriptions.unarchive);

  const rows: SubscriptionRow[] = useMemo(() =>
    (subscriptions ?? []).map((sub) => ({
      id: sub.id,
      name: sub.name,
      interval: sub.interval as any,
      billingDay: sub.billingDay,
      nextBillingDate: sub.nextBillingDate,
      generatedCount: sub.generatedCount,
      numberOfInvoices: sub.numberOfInvoices,
      state: sub.state as any,
      companyName: sub.companyName,
      contactName: sub.contactName,
      currency: sub.currency,
      lineCount: sub.lineCount,
      archivedAt: sub.archivedAt,
    })),
    [subscriptions],
  );

  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const selectedIds = selections["subscriptions"] ?? new Set<string>();
  const toggleOneSub = useCallback((id: string) => toggleOne("subscriptions", id), [toggleOne]);
  const toggleAllSub = useCallback(() => toggleAll("subscriptions", allIds), [toggleAll, allIds]);

  const columns = useMemo(
    () => getColumns({ selectedIds, toggleOne: toggleOneSub, allIds, toggleAll: toggleAllSub }),
    [selectedIds, toggleOneSub, allIds, toggleAllSub],
  );

  const handleBulkArchive = async () => {
    const ids = [...selectedIds];
    const results = await Promise.allSettled(ids.map((id) => archiveSub.mutateAsync({ id: id as any })));
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed === 0) toast.success(`${ids.length} archived`);
    else toast.error(`Archived ${ids.length - failed}/${ids.length}. ${failed} failed.`);
    clearSelection("subscriptions");
  };

  const handleBulkRestore = async () => {
    const ids = [...selectedIds];
    const results = await Promise.allSettled(ids.map((id) => unarchiveSub.mutateAsync({ id: id as any })));
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed === 0) toast.success(`${ids.length} restored`);
    else toast.error(`Restored ${ids.length - failed}/${ids.length}. ${failed} failed.`);
    clearSelection("subscriptions");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <DataTableExportButton
          data={rows.map((r) => ({
            name: r.name,
            interval: r.interval,
            nextBillingDate: r.nextBillingDate ? new Date(r.nextBillingDate).toLocaleDateString() : '',
            generatedCount: r.generatedCount,
            state: r.state,
            companyName: r.companyName ?? '',
            contactName: r.contactName ?? '',
          }))}
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'interval', label: 'Interval' },
            { key: 'nextBillingDate', label: 'Next Billing' },
            { key: 'generatedCount', label: 'Generated' },
            { key: 'state', label: 'State' },
            { key: 'companyName', label: 'Company' },
            { key: 'contactName', label: 'Contact' },
          ]}
          filename={`subscriptions-${new Date().toISOString().split('T')[0]}`}
        />
        <Button size="sm" onClick={() => router.push('/subscriptions/new')}>
          <Plus className="mr-1 h-4 w-4" />New Subscription
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search subscriptions..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={stateFilter ?? "__all__"} onValueChange={(v) => setStateFilter(v === "__all__" ? null : v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Button variant={showArchived ? 'default' : 'outline'} size="sm" onClick={toggleArchived}>
          {showArchived ? 'Hide Archived' : 'Show Archived'}
        </Button>
      </div>

      {isLoading ? (
        <DataTableSkeleton columns={[
          { type: "checkbox" }, { type: "avatar-text", width: "w-32" },
          { type: "text", width: "w-24" }, { type: "badge" },
          { type: "text", width: "w-24" }, { type: "text", width: "w-20" },
          { type: "badge" }, { type: "icon" },
        ]} />
      ) : search && !rows.length ? (
        <NoResults searchQuery={search} onClear={() => setSearch('')} />
      ) : !rows.length ? (
        <EmptyState
          icon={<RefreshCw className="size-7" />} title="No subscriptions yet"
          description="Create your first subscription to automate recurring billing."
          action={<Button variant="outline" size="sm" onClick={() => router.push('/subscriptions/new')}><Plus className="mr-1 h-4 w-4" />Create Subscription</Button>}
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          onRowClick={(row) => router.push(`/subscriptions/${row.id}`)}
          rowClassName={(row) => `${row.archivedAt ? 'opacity-60' : ''} ${selectedIds.has(row.id) ? 'bg-muted/30' : ''}`}
        />
      )}

      <FloatingSelectionBar
        count={selectedIds.size}
        onClear={() => clearSelection("subscriptions")}
        onArchive={handleBulkArchive}
        onRestore={handleBulkRestore}
        showRestore={showArchived}
        isArchiving={archiveSub.isPending}
      />
    </div>
  );
}
