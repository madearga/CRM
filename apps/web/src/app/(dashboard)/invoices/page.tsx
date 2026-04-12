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
import { FileText, Plus, Search } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { NoResults } from '@/components/no-results';
import { DataTable, DataTableSkeleton } from '@/components/data-table';
import { FloatingSelectionBar } from '@/components/floating-selection-bar';
import { getColumns, type InvoiceRow } from './columns';
import { useInvoicesParams } from '@/hooks/use-invoices-params';
import { useTableStore } from '@/store/table-store';
import { toast } from 'sonner';

export default function InvoicesPage() {
  const router = useRouter();
  const { q: search, archived: showArchived, setSearch, toggleArchived } = useInvoicesParams();
  const { selections, toggleOne, toggleAll, clearSelection } = useTableStore();
  const selectedIds = selections.invoices ?? new Set();
  const [stateFilter, setStateFilter] = useState<string | undefined>(undefined);
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);

  const { data: invoices, isLoading } = useAuthPaginatedQuery(api.invoices.list, {
    search: search || undefined,
    includeArchived: showArchived,
    state: (stateFilter as any) || undefined,
    type: (typeFilter as any) || undefined,
  }, { initialNumItems: 50 });

  const archiveInvoice = useAuthMutation(api.invoices.archive);
  const unarchiveInvoice = useAuthMutation(api.invoices.unarchive);

  const rows: InvoiceRow[] = useMemo(() =>
    (invoices ?? []).map((inv) => ({
      id: inv.id,
      number: inv.number,
      type: inv.type as any,
      state: inv.state as any,
      invoiceDate: inv.invoiceDate,
      dueDate: inv.dueDate,
      totalAmount: inv.totalAmount,
      amountDue: inv.amountDue,
      currency: inv.currency,
      paymentStatus: inv.paymentStatus as any,
      companyId: inv.companyId,
      contactId: inv.contactId,
      organizationId: inv.organizationId,
      ownerId: inv.ownerId,
      archivedAt: inv.archivedAt,
      companyName: inv.companyName,
      contactName: inv.contactName,
    })),
    [invoices],
  );

  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const toggleOneInv = useCallback((id: string) => toggleOne("invoices", id), [toggleOne]);
  const toggleAllInv = useCallback(() => toggleAll("invoices", allIds), [toggleAll, allIds]);

  const columns = useMemo(
    () => getColumns({ selectedIds, toggleOne: toggleOneInv, allIds, toggleAll: toggleAllInv }),
    [selectedIds, toggleOneInv, allIds, toggleAllInv],
  );

  const handleBulkArchive = async () => {
    const ids = [...selectedIds];
    const results = await Promise.allSettled(ids.map((id) => archiveInvoice.mutateAsync({ id: id as any })));
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed === 0) toast.success(`${ids.length} archived`);
    else toast.error(`Archived ${ids.length - failed}/${ids.length}. ${failed} failed.`);
    clearSelection("invoices");
  };

  const handleBulkRestore = async () => {
    const ids = [...selectedIds];
    const results = await Promise.allSettled(ids.map((id) => unarchiveInvoice.mutateAsync({ id: id as any })));
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed === 0) toast.success(`${ids.length} restored`);
    else toast.error(`Restored ${ids.length - failed}/${ids.length}. ${failed} failed.`);
    clearSelection("invoices");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" onClick={() => router.push('/invoices/new')}>
          <Plus className="mr-1 h-4 w-4" />New Invoice
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search invoices..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter ?? "__all__"} onValueChange={(v) => setTypeFilter(v === "__all__" ? undefined : v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All types</SelectItem>
            <SelectItem value="customer_invoice">Customer Invoice</SelectItem>
            <SelectItem value="vendor_bill">Vendor Bill</SelectItem>
            <SelectItem value="credit_note">Credit Note</SelectItem>
          </SelectContent>
        </Select>
        <Select value={stateFilter ?? "__all__"} onValueChange={(v) => setStateFilter(v === "__all__" ? undefined : v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="posted">Posted</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
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
          { type: "text", width: "w-20" }, { type: "badge" },
          { type: "badge" }, { type: "text", width: "w-24" },
          { type: "icon" },
        ]} />
      ) : search && !rows.length ? (
        <NoResults searchQuery={search} onClear={() => setSearch('')} />
      ) : !rows.length ? (
        <EmptyState
          icon={<FileText className="size-7" />} title="No invoices yet"
          description="Create your first invoice or bill to start tracking payments."
          action={<Button variant="outline" size="sm" onClick={() => router.push('/invoices/new')}><Plus className="mr-1 h-4 w-4" />Create Invoice</Button>}
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          onRowClick={(row) => router.push(`/invoices/${row.id}`)}
          rowClassName={(row) => `${row.archivedAt ? 'opacity-60' : ''} ${selectedIds.has(row.id) ? 'bg-muted/30' : ''}`}
        />
      )}

      <FloatingSelectionBar
        count={selectedIds.size}
        onClear={() => clearSelection("invoices")}
        onArchive={handleBulkArchive}
        onRestore={handleBulkRestore}
        showRestore={showArchived}
        isArchiving={archiveInvoice.isPending}
      />
    </div>
  );
}
