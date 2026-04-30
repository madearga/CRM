'use client';

import { useState, useMemo } from 'react';
import { useAuthQuery, useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Clock } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { DataTable, DataTableSkeleton } from '@/components/data-table';
import { getColumns, type ShiftRow } from './columns';
import { toast } from 'sonner';
import { usePermission } from '@/lib/permissions/use-permission';

const DAYS = [
  { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' }, { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' }, { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

export default function ShiftsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newShift, setNewShift] = useState({
    name: '', startTime: '08:00', endTime: '16:00',
    lateToleranceMinutes: 15, branchId: '', daysOfWeek: [1, 2, 3, 4, 5],
  });

  const canView = usePermission('hr_shifts', 'view');
  const canCreate = usePermission('hr_shifts', 'create');

  const { data: shifts, isLoading } = useAuthQuery((api as any).hrShifts.list, {});
  const { data: branches } = useAuthQuery((api as any).hrBranches.list, {});

  const createShift = useAuthMutation((api as any).hrShifts.create);
  const removeShift = useAuthMutation((api as any).hrShifts.remove);

  const handleDelete = async (id: string) => {
    try {
      await removeShift.mutateAsync({ id } as any);
      toast.success('Shift deleted');
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to delete shift');
    }
  };

  const rows: ShiftRow[] = useMemo(
    () => (shifts ?? []).map((s: any) => ({
      id: s.id, name: s.name, startTime: s.startTime, endTime: s.endTime,
      lateToleranceMinutes: s.lateToleranceMinutes, daysOfWeek: s.daysOfWeek,
    })),
    [shifts],
  );

  const columns = useMemo(() => getColumns({ onDelete: handleDelete }), []);

  const toggleDay = (day: number) => {
    setNewShift((p) => ({
      ...p,
      daysOfWeek: p.daysOfWeek.includes(day)
        ? p.daysOfWeek.filter((d) => d !== day)
        : [...p.daysOfWeek, day].sort(),
    }));
  };

  const handleCreate = async () => {
    if (!newShift.name.trim() || !newShift.branchId) {
      toast.error('Shift name and branch are required');
      return;
    }
    try {
      await createShift.mutateAsync({
        name: newShift.name.trim(),
        startTime: newShift.startTime,
        endTime: newShift.endTime,
        lateToleranceMinutes: newShift.lateToleranceMinutes,
        daysOfWeek: newShift.daysOfWeek,
        branchId: newShift.branchId,
      } as any);
      toast.success(`Shift "${newShift.name}" created`);
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to create shift');
    }
  };

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        You don't have permission to view shifts.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Shifts</h1>
        {canCreate && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-1 h-4 w-4" />Add Shift</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Shift</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Shift name *" value={newShift.name} onChange={(e) => setNewShift((p) => ({ ...p, name: e.target.value }))} />
                <Select value={newShift.branchId} onValueChange={(v) => setNewShift((p) => ({ ...p, branchId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Branch *" /></SelectTrigger>
                  <SelectContent>
                    {(branches ?? []).map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Start Time</label>
                    <Input type="time" value={newShift.startTime} onChange={(e) => setNewShift((p) => ({ ...p, startTime: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">End Time</label>
                    <Input type="time" value={newShift.endTime} onChange={(e) => setNewShift((p) => ({ ...p, endTime: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Late Tolerance (minutes)</label>
                  <Input type="number" min={0} value={newShift.lateToleranceMinutes} onChange={(e) => setNewShift((p) => ({ ...p, lateToleranceMinutes: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Active Days</label>
                  <div className="flex gap-1 flex-wrap">
                    {DAYS.map((d) => (
                      <Button
                        key={d.value} type="button" size="sm"
                        variant={newShift.daysOfWeek.includes(d.value) ? 'default' : 'outline'}
                        onClick={() => toggleDay(d.value)}
                      >
                        {d.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <Button onClick={handleCreate} className="w-full" disabled={createShift.isPending}>Create Shift</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <DataTableSkeleton columns={[
          { type: 'text', width: 'w-32' }, { type: 'text', width: 'w-32' },
          { type: 'text', width: 'w-16' }, { type: 'text', width: 'w-40' }, { type: 'icon' },
        ]} />
      ) : !rows.length ? (
        <EmptyState
          icon={<Clock className="size-7" />} title="No shifts yet"
          description="Create shift definitions to schedule employees."
          action={canCreate ? <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}><Plus className="mr-1 h-4 w-4" />Add shift</Button> : undefined}
        />
      ) : (
        <DataTable columns={columns} data={rows} />
      )}
    </div>
  );
}
