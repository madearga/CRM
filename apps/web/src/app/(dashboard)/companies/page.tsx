'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthPaginatedQuery, useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Building2, Plus, Search } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { NoResults } from '@/components/no-results';
import { DataTable, DataTableSkeleton } from '@/components/data-table';
import { FloatingSelectionBar } from '@/components/floating-selection-bar';
import { getColumns, type CompanyRow } from './columns';
import { useCompaniesParams } from '@/hooks/use-companies-params';
import { useTableStore } from '@/store/table-store';
import { toast } from 'sonner';

export default function CompaniesPage() {
  const router = useRouter();
  const { q: search, archived: showArchived, setSearch, toggleArchived } = useCompaniesParams();
  const { selections, toggleOne, toggleAll, clearSelection } = useTableStore();
  const selectedIds = useMemo(() => selections.companies ?? new Set(), [selections.companies]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newCompany, setNewCompany] = useState({
    name: '', website: '', industry: '', size: undefined as string | undefined,
    country: '', source: undefined as string | undefined,
  });

  const { data: companies, isLoading } = useAuthPaginatedQuery(api.companies.list, {
    search: search || undefined,
    includeArchived: showArchived,
  }, { initialNumItems: 50 });

  const createCompany = useAuthMutation(api.companies.create);
  const archiveCompany = useAuthMutation(api.companies.archive);
  const restoreCompany = useAuthMutation(api.companies.restore);

  const rows: CompanyRow[] = useMemo(() =>
    (companies ?? []).map((c) => ({
      id: c.id, name: c.name, website: c.website, industry: c.industry,
      country: c.country, source: c.source, status: c.status, archivedAt: c.archivedAt,
    })),
    [companies],
  );

  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);

  const toggleOneCompany = useCallback((id: string) => toggleOne("companies", id), [toggleOne]);
  const toggleAllCompanies = useCallback(() => toggleAll("companies", allIds), [toggleAll, allIds]);

  const columns = useMemo(
    () => getColumns({
      selectedIds,
      toggleOne: toggleOneCompany,
      allIds,
      toggleAll: toggleAllCompanies,
    }),
    [selectedIds, toggleOneCompany, allIds, toggleAllCompanies],
  );

  const handleCreate = async () => {
    const trimmed = newCompany.name.trim();
    if (!trimmed) { toast.error('Company name is required'); return; }
    if (trimmed.length > 200) { toast.error('Name must be 200 characters or less'); return; }
    try {
      await createCompany.mutateAsync({
        name: trimmed, website: newCompany.website || undefined,
        industry: newCompany.industry || undefined, size: newCompany.size as any,
        country: newCompany.country || undefined, source: newCompany.source as any,
      });
      toast.success(`Company "${newCompany.name}" created`);
      setNewCompany((p) => ({ ...p, name: '', website: '', industry: '', size: undefined, country: '', source: undefined }));
      setDialogOpen(false);
    } catch (e: any) { toast.error(e.data?.message ?? 'Failed to create company'); }
  };

  const handleBulkArchive = async () => {
    const ids = [...selectedIds];
    const results = await Promise.allSettled(ids.map((id) => archiveCompany.mutateAsync({ id: id as any })));
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed === 0) toast.success(`${ids.length} ${ids.length === 1 ? 'company' : 'companies'} archived`);
    else toast.error(`Archived ${ids.length - failed}/${ids.length}. ${failed} failed.`);
    clearSelection("companies");
  };

  const handleBulkRestore = async () => {
    const ids = [...selectedIds];
    const results = await Promise.allSettled(ids.map((id) => restoreCompany.mutateAsync({ id: id as any })));
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed === 0) toast.success(`${ids.length} ${ids.length === 1 ? 'company' : 'companies'} restored`);
    else toast.error(`Restored ${ids.length - failed}/${ids.length}. ${failed} failed.`);
    clearSelection("companies");
  };

  return (
    <div className="space-y-4">
      {/* Header + Add */}
      <div className="flex items-center justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1 h-4 w-4" />Add Company</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Company</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Company name *" value={newCompany.name} onChange={(e) => setNewCompany((p) => ({ ...p, name: e.target.value }))} />
              <Input placeholder="Website" value={newCompany.website} onChange={(e) => setNewCompany((p) => ({ ...p, website: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Industry" value={newCompany.industry} onChange={(e) => setNewCompany((p) => ({ ...p, industry: e.target.value }))} />
                <Select value={newCompany.size} onValueChange={(v) => setNewCompany((p) => ({ ...p, size: v }))}>
                  <SelectTrigger><SelectValue placeholder="Size" /></SelectTrigger>
                  <SelectContent>
                    {['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Country" value={newCompany.country} onChange={(e) => setNewCompany((p) => ({ ...p, country: e.target.value }))} />
                <Select value={newCompany.source} onValueChange={(v) => setNewCompany((p) => ({ ...p, source: v }))}>
                  <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
                  <SelectContent>
                    {['referral', 'website', 'linkedin', 'cold', 'event', 'other'].map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} className="w-full" disabled={createCompany.isPending}>Create Company</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search companies..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button variant={showArchived ? 'default' : 'outline'} size="sm" onClick={toggleArchived}>
          {showArchived ? 'Hide Archived' : 'Show Archived'}
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <DataTableSkeleton columns={[
          { type: "checkbox" }, { type: "avatar-text", width: "w-32" },
          { type: "text", width: "w-20" }, { type: "text", width: "w-16" },
          { type: "text", width: "w-16" }, { type: "badge" }, { type: "icon" },
        ]} />
      ) : search && !rows.length ? (
        <NoResults searchQuery={search} onClear={() => setSearch('')} />
      ) : !rows.length ? (
        <EmptyState
          icon={<Building2 className="size-7" />} title="No companies yet"
          description="Add your first company to start building your CRM pipeline."
          action={<Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}><Plus className="mr-1 h-4 w-4" />Add your first company</Button>}
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          onRowClick={(row) => router.push(`/companies/${row.id}`)}
          rowClassName={(row) => `${row.archivedAt ? 'opacity-60' : ''} ${selectedIds.has(row.id) ? 'bg-muted/30' : ''}`}
        />
      )}

      {/* Floating Selection Bar */}
      <FloatingSelectionBar
        count={selectedIds.size}
        onClear={() => clearSelection("companies")}
        onArchive={handleBulkArchive}
        onRestore={handleBulkRestore}
        showRestore={showArchived}
        isArchiving={archiveCompany.isPending}
      />
    </div>
  );
}
