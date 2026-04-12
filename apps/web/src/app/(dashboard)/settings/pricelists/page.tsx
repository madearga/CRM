'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthPaginatedQuery, useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, MoreHorizontal, Tag, Archive, Copy, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';

const typeBadgeMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  fixed: { label: 'Fixed', variant: 'default' },
  percentage_discount: { label: '% Discount', variant: 'secondary' },
  formula: { label: 'Formula', variant: 'outline' },
};

export default function PricelistsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useAuthPaginatedQuery(
    api.pricelists.list,
    { search: search || undefined },
    { initialNumItems: 50 }
  );

  const archiveMutation = useAuthMutation(api.pricelists.archive);
  const unarchiveMutation = useAuthMutation(api.pricelists.unarchive);
  const duplicateMutation = useAuthMutation(api.pricelists.duplicate);
  const removeMutation = useAuthMutation(api.pricelists.remove);

  const pricelists = data ?? [];

  const handleArchive = async (id: string) => {
    try {
      await archiveMutation.mutateAsync({ id: id as any });
      toast.success('Pricelist archived');
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to archive');
    }
  };

  const handleUnarchive = async (id: string) => {
    try {
      await unarchiveMutation.mutateAsync({ id: id as any });
      toast.success('Pricelist restored');
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to restore');
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateMutation.mutateAsync({ id: id as any });
      toast.success('Pricelist duplicated');
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to duplicate');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Permanently delete this pricelist and all its rules?')) return;
    try {
      await removeMutation.mutateAsync({ id: id as any });
      toast.success('Pricelist deleted');
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to delete');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pricelists</h1>
          <p className="text-sm text-muted-foreground">
            Manage pricing rules, volume discounts, and customer-specific pricing.
          </p>
        </div>
        <Button onClick={() => router.push('/settings/pricelists/new')}>
          <Plus className="mr-1 h-4 w-4" /> New Pricelist
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search pricelists..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-center">Rules</TableHead>
                <TableHead className="text-center">Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : pricelists.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No pricelists found. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                pricelists.map((pl: any) => {
                  const badge = typeBadgeMap[pl.type] ?? { label: pl.type, variant: 'outline' as const };
                  return (
                    <TableRow
                      key={pl.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/settings/pricelists/${pl.id}`)}
                    >
                      <TableCell className="font-medium">
                        <div>
                          {pl.name}
                          {pl.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{pl.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </TableCell>
                      <TableCell className="text-center">{pl.ruleCount}</TableCell>
                      <TableCell className="text-center">{pl.priority ?? '—'}</TableCell>
                      <TableCell>
                        {pl.archivedAt ? (
                          <Badge variant="outline" className="text-muted-foreground">Archived</Badge>
                        ) : pl.isActive ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/settings/pricelists/${pl.id}`); }}>
                              <Tag className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDuplicate(pl.id); }}>
                              <Copy className="mr-2 h-4 w-4" /> Duplicate
                            </DropdownMenuItem>
                            {pl.archivedAt ? (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleUnarchive(pl.id); }}>
                                <Archive className="mr-2 h-4 w-4" /> Restore
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleArchive(pl.id); }}>
                                <Archive className="mr-2 h-4 w-4" /> Archive
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={(e) => { e.stopPropagation(); handleDelete(pl.id); }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
