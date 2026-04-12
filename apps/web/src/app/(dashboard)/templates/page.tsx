'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthPaginatedQuery, useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, Plus, Search } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { NoResults } from '@/components/no-results';
import { DataTable, DataTableSkeleton } from '@/components/data-table';
import { FloatingSelectionBar } from '@/components/floating-selection-bar';
import { getColumns, type TemplateRow } from './columns';
import { useTableStore } from '@/store/table-store';
import { toast } from 'sonner';

export default function TemplatesPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const { selections, toggleOne, toggleAll, clearSelection } = useTableStore();
  const selectedIds = useMemo(() => selections.templates ?? new Set(), [selections.templates]);

  const { data: templates, isLoading } = useAuthPaginatedQuery(api.quotationTemplates.list, {
    search: search || undefined,
    includeArchived: showArchived,
  }, { initialNumItems: 50 });

  const archiveTmpl = useAuthMutation(api.quotationTemplates.archive);
  const unarchiveTmpl = useAuthMutation(api.quotationTemplates.unarchive);

  const rows: TemplateRow[] = useMemo(() =>
    (templates ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      discountAmount: t.discountAmount,
      discountType: t.discountType,
      lineCount: t.lineCount,
      isDefault: t.isDefault,
      archivedAt: t.archivedAt,
    })),
    [templates],
  );

  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const toggleOneTmpl = useCallback((id: string) => toggleOne('templates', id), [toggleOne]);
  const toggleAllTmpl = useCallback(() => toggleAll('templates', allIds), [toggleAll, allIds]);

  const columns = useMemo(
    () => getColumns({ selectedIds, toggleOne: toggleOneTmpl, allIds, toggleAll: toggleAllTmpl }),
    [selectedIds, toggleOneTmpl, allIds, toggleAllTmpl],
  );

  const handleBulkArchive = async () => {
    const ids = [...selectedIds];
    const results = await Promise.allSettled(ids.map((id) => archiveTmpl.mutateAsync({ id: id as any })));
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed === 0) toast.success(`${ids.length} archived`);
    else toast.error(`Archived ${ids.length - failed}/${ids.length}. ${failed} failed.`);
    clearSelection('templates');
  };

  const handleBulkRestore = async () => {
    const ids = [...selectedIds];
    const results = await Promise.allSettled(ids.map((id) => unarchiveTmpl.mutateAsync({ id: id as any })));
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed === 0) toast.success(`${ids.length} restored`);
    else toast.error(`Restored ${ids.length - failed}/${ids.length}. ${failed} failed.`);
    clearSelection('templates');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" onClick={() => router.push('/templates/new')}>
          <Plus className="mr-1 h-4 w-4" />New Template
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search templates..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button variant={showArchived ? 'default' : 'outline'} size="sm" onClick={() => setShowArchived(!showArchived)}>
          {showArchived ? 'Hide Archived' : 'Show Archived'}
        </Button>
      </div>

      {isLoading ? (
        <DataTableSkeleton columns={[
          { type: 'checkbox' }, { type: 'avatar-text', width: 'w-32' },
          { type: 'text', width: 'w-24' }, { type: 'text', width: 'w-16' },
          { type: 'badge' }, { type: 'icon' },
        ]} />
      ) : search && !rows.length ? (
        <NoResults searchQuery={search} onClear={() => setSearch('')} />
      ) : !rows.length ? (
        <EmptyState
          icon={<FileText className="size-7" />} title="No templates yet"
          description="Create a quotation template to pre-fill line items and pricing."
          action={<Button variant="outline" size="sm" onClick={() => router.push('/templates/new')}><Plus className="mr-1 h-4 w-4" />Create Template</Button>}
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          onRowClick={(row) => router.push(`/templates/${row.id}/edit`)}
          rowClassName={(row) => `${row.archivedAt ? 'opacity-60' : ''} ${selectedIds.has(row.id) ? 'bg-muted/30' : ''}`}
        />
      )}

      <FloatingSelectionBar
        count={selectedIds.size}
        onClear={() => clearSelection('templates')}
        onArchive={handleBulkArchive}
        onRestore={handleBulkRestore}
        showRestore={showArchived}
        isArchiving={archiveTmpl.isPending}
      />
    </div>
  );
}
