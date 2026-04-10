'use client';

import { useState, useCallback } from 'react';
import { useAuthPaginatedQuery, useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, Globe, Plus, Search, Archive, RotateCcw, X } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { STATUS_COLORS } from '@/lib/constants';
import { toast } from 'sonner';
import Link from 'next/link';

export default function CompaniesPage() {
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [newCompany, setNewCompany] = useState({
    name: '',
    website: '',
    industry: '',
    size: undefined as string | undefined,
    country: '',
    source: undefined as string | undefined,
  });

  const { data: companies, isLoading } = useAuthPaginatedQuery(api.companies.list, {
    search: search || undefined,
    includeArchived: showArchived,
  }, { initialNumItems: 50 });

  const createCompany = useAuthMutation(api.companies.create);
  const archiveCompany = useAuthMutation(api.companies.archive);
  const restoreCompany = useAuthMutation(api.companies.restore);

  const allIds = companies?.map((c) => c.id) ?? [];
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  }, [allIds, allSelected]);

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleCreate = async () => {
    if (!newCompany.name.trim()) {
      toast.error('Company name is required');
      return;
    }
    try {
      await createCompany.mutateAsync({
        name: newCompany.name.trim(),
        website: newCompany.website || undefined,
        industry: newCompany.industry || undefined,
        size: newCompany.size as any,
        country: newCompany.country || undefined,
        source: newCompany.source as any,
      });
      toast.success(`Company "${newCompany.name}" created`);
      setNewCompany({ name: '', website: '', industry: '', size: undefined, country: '', source: undefined });
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to create company');
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await archiveCompany.mutateAsync({ id: id as any });
      toast.success('Company archived');
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to archive');
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await restoreCompany.mutateAsync({ id: id as any });
      toast.success('Company restored');
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to restore');
    }
  };

  const handleBulkArchive = async () => {
    const ids = [...selectedIds];
    const count = ids.length;
    const results = await Promise.allSettled(
      ids.map((id) => archiveCompany.mutateAsync({ id: id as any }))
    );
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed === 0) {
      toast.success(`${count} ${count === 1 ? 'company' : 'companies'} archived`);
    } else {
      toast.error(`Archived ${count - failed}/${count}. ${failed} failed.`);
    }
    setSelectedIds(new Set());
  };

  const handleBulkRestore = async () => {
    const ids = [...selectedIds];
    const count = ids.length;
    const results = await Promise.allSettled(
      ids.map((id) => restoreCompany.mutateAsync({ id: id as any }))
    );
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed === 0) {
      toast.success(`${count} ${count === 1 ? 'company' : 'companies'} restored`);
    } else {
      toast.error(`Restored ${count - failed}/${count}. ${failed} failed.`);
    }
    setSelectedIds(new Set());
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" />
              Add Company
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Company</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="Company name *"
                value={newCompany.name}
                onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
              />
              <Input
                placeholder="Website"
                value={newCompany.website}
                onChange={(e) => setNewCompany({ ...newCompany, website: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Industry"
                  value={newCompany.industry}
                  onChange={(e) => setNewCompany({ ...newCompany, industry: e.target.value })}
                />
                <Select
                  value={newCompany.size}
                  onValueChange={(v) => setNewCompany({ ...newCompany, size: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Size" />
                  </SelectTrigger>
                  <SelectContent>
                    {['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Country"
                  value={newCompany.country}
                  onChange={(e) => setNewCompany({ ...newCompany, country: e.target.value })}
                />
                <Select
                  value={newCompany.source}
                  onValueChange={(v) => setNewCompany({ ...newCompany, source: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent>
                    {['referral', 'website', 'linkedin', 'cold', 'event', 'other'].map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} className="w-full" disabled={createCompany.isPending}>
                Create Company
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search companies..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          variant={showArchived ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowArchived(!showArchived)}
        >
          {showArchived ? 'Hide Archived' : 'Show Archived'}
        </Button>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2">
          <span className="text-sm font-medium">
            {selectedIds.size} selected
          </span>
          <div className="h-4 w-px bg-border" />
          <Button variant="outline" size="sm" onClick={handleBulkArchive}>
            <Archive className="mr-1 h-3.5 w-3.5" />
            Archive
          </Button>
          {showArchived && (
            <Button variant="outline" size="sm" onClick={handleBulkRestore}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              Restore
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
            <X className="mr-1 h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !companies?.length ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<Building2 className="size-7" />}
              title="No companies yet"
              description="Add your first company to start building your CRM pipeline."
              action={
                <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
                  <Plus className="mr-1 h-4 w-4" />
                  Add your first company
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((company) => (
                <TableRow key={company.id} className={`cursor-pointer transition-colors hover:bg-muted/50 ${company.archivedAt ? 'opacity-60' : ''} ${selectedIds.has(company.id) ? 'bg-muted/30' : ''}`}>
                  <TableCell className="pr-0">
                    <Checkbox
                      checked={selectedIds.has(company.id)}
                      onCheckedChange={() => toggleOne(company.id)}
                      aria-label={`Select ${company.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
                        <Building2 className="size-4" />
                      </div>
                      <div>
                        <Link href={`/companies/${company.id}`} className="font-medium hover:underline">
                          {company.name}
                        </Link>
                        {company.website && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Globe className="h-3 w-3" />
                            {company.website.replace(/^https?:\/\//, '')}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{company.industry ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{company.country ?? '—'}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{company.source ?? '—'}</TableCell>
                  <TableCell>
                    {company.status ? (
                      <Badge variant="secondary" className={STATUS_COLORS[company.status]}>
                        {company.status}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                    {company.archivedAt && (
                      <Badge variant="secondary" className="ml-1 bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400">
                        archived
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {company.archivedAt ? (
                      <Button variant="ghost" size="sm" onClick={() => handleRestore(company.id)}>
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => handleArchive(company.id)}>
                        <Archive className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
