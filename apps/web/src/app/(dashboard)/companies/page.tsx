'use client';

import { useState } from 'react';
import { useAuthPaginatedQuery, useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Building2, Plus, Search, Archive, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  inactive: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  prospect: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

export default function CompaniesPage() {
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Companies</h2>
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

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !companies?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">No companies yet</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Add your first company
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((company) => (
                <TableRow key={company.id} className={company.archivedAt ? 'opacity-60' : ''}>
                  <TableCell>
                    <Link href={`/companies/${company.id}`} className="font-medium hover:underline">
                      {company.name}
                    </Link>
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
