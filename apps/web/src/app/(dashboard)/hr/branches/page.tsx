'use client';

import { useState, useMemo } from 'react';
import { useAuthQuery, useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { MapPin, Plus, Search } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { NoResults } from '@/components/no-results';
import { DataTable, DataTableSkeleton } from '@/components/data-table';
import { getColumns, type BranchRow } from './columns';
import { toast } from 'sonner';
import { usePermission } from '@/lib/permissions/use-permission';

export default function BranchesPage() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newBranch, setNewBranch] = useState({
    name: '', address: '', phone: '',
  });

  const canView = usePermission('hr_branches', 'view');
  const canCreate = usePermission('hr_branches', 'create');

  const { data: branches, isLoading } = useAuthQuery(
    (api as any).hrBranches.list,
    { includeInactive: true },
  );

  const createBranch = useAuthMutation((api as any).hrBranches.create);
  const updateBranch = useAuthMutation((api as any).hrBranches.update);
  const regenerateQr = useAuthMutation((api as any).hrBranches.regenerateQr);

  const rows: BranchRow[] = useMemo(
    () =>
      (branches ?? [])
        .filter((b: any) => !search || b.name.toLowerCase().includes(search.toLowerCase()) || (b.address ?? '').toLowerCase().includes(search.toLowerCase()))
        .map((b: any) => ({
          id: b.id, name: b.name, address: b.address, phone: b.phone,
          qrCode: b.qrCode, isActive: b.isActive, createdAt: b.createdAt,
        })),
    [branches, search],
  );

  const handleRegenerateQr = async (id: string) => {
    try {
      const qr = await regenerateQr.mutateAsync({ id } as any);
      toast.success(`QR code regenerated: ${qr}`);
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to regenerate QR');
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await updateBranch.mutateAsync({ id, isActive: !isActive } as any);
      toast.success(`Branch ${!isActive ? 'activated' : 'deactivated'}`);
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to update branch');
    }
  };

  const handleCreate = async () => {
    const trimmed = newBranch.name.trim();
    if (!trimmed) { toast.error('Branch name is required'); return; }
    try {
      await createBranch.mutateAsync({
        name: trimmed,
        address: newBranch.address || undefined,
        phone: newBranch.phone || undefined,
      } as any);
      toast.success(`Branch "${trimmed}" created`);
      setNewBranch({ name: '', address: '', phone: '' });
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to create branch');
    }
  };

  const columns = useMemo(() => getColumns({ onRegenerateQr: handleRegenerateQr }), []);

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        You don't have permission to view branches.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Branches</h1>
        {canCreate && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-1 h-4 w-4" />Add Branch</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Branch</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Branch name *" value={newBranch.name} onChange={(e) => setNewBranch((p) => ({ ...p, name: e.target.value }))} />
                <Input placeholder="Address" value={newBranch.address} onChange={(e) => setNewBranch((p) => ({ ...p, address: e.target.value }))} />
                <Input placeholder="Phone" value={newBranch.phone} onChange={(e) => setNewBranch((p) => ({ ...p, phone: e.target.value }))} />
                <Button onClick={handleCreate} className="w-full" disabled={createBranch.isPending}>Create Branch</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search branches..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <DataTableSkeleton columns={[
          { type: 'text', width: 'w-32' }, { type: 'text', width: 'w-40' },
          { type: 'text', width: 'w-24' }, { type: 'badge' }, { type: 'icon' },
        ]} />
      ) : search && !rows.length ? (
        <NoResults searchQuery={search} onClear={() => setSearch('')} />
      ) : !rows.length ? (
        <EmptyState
          icon={<MapPin className="size-7" />} title="No branches yet"
          description="Add your first branch to start managing attendance locations."
          action={canCreate ? <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}><Plus className="mr-1 h-4 w-4" />Add branch</Button> : undefined}
        />
      ) : (
        <DataTable columns={columns} data={rows} />
      )}
    </div>
  );
}
