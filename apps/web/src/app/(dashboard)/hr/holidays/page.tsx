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
import { Plus, CalendarDays, Trash2, Upload } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { usePermission } from '@/lib/permissions/use-permission';

export default function HolidaysPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '', isRecurring: true });
  const [bulkText, setBulkText] = useState('');

  const canView = usePermission('hr_holidays', 'view');
  const canCreate = usePermission('hr_holidays', 'create');
  const canDelete = usePermission('hr_holidays', 'delete');

  const { data: holidays, isLoading } = useAuthQuery((api as any).hrHolidays.list, {});
  const createHoliday = useAuthMutation((api as any).hrHolidays.create);
  const removeHoliday = useAuthMutation((api as any).hrHolidays.remove);
  const importBulk = useAuthMutation((api as any).hrHolidays.importBulk);

  const sorted = useMemo(
    () => [...(holidays ?? [])].sort((a: any, b: any) => a.date.localeCompare(b.date)),
    [holidays],
  );

  const handleCreate = async () => {
    if (!newHoliday.date || !newHoliday.name.trim()) {
      toast.error('Date and name are required');
      return;
    }
    try {
      await createHoliday.mutateAsync({
        date: newHoliday.date,
        name: newHoliday.name.trim(),
        isRecurring: newHoliday.isRecurring,
      } as any);
      toast.success(`Holiday "${newHoliday.name}" added`);
      setNewHoliday({ date: '', name: '', isRecurring: true });
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to add holiday');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await removeHoliday.mutateAsync({ id } as any);
      toast.success('Holiday deleted');
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to delete');
    }
  };

  const handleBulkImport = async () => {
    const lines = bulkText.trim().split('\n').filter((l) => l.trim());
    if (lines.length === 0) { toast.error('No entries'); return; }
    const entries = lines.map((line) => {
      const [date, ...nameParts] = line.split(',');
      return { date: date.trim(), name: nameParts.join(',').trim(), isRecurring: false };
    });
    try {
      const result = await importBulk.mutateAsync({ holidays: entries } as any);
      toast.success(`Imported ${result.created}, skipped ${result.skipped}`);
      setBulkText('');
      setImportOpen(false);
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to import');
    }
  };

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        You don't have permission to view holidays.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Holidays</h1>
        {canCreate && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="mr-1 h-4 w-4" />Import
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-1 h-4 w-4" />Add Holiday</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Holiday</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <Input type="date" value={newHoliday.date} onChange={(e) => setNewHoliday((p) => ({ ...p, date: e.target.value }))} />
                  <Input placeholder="Holiday name *" value={newHoliday.name} onChange={(e) => setNewHoliday((p) => ({ ...p, name: e.target.value }))} />
                  <div className="flex items-center gap-2">
                    <Switch checked={newHoliday.isRecurring} onCheckedChange={(v) => setNewHoliday((p) => ({ ...p, isRecurring: v }))} />
                    <Label>Recurring (yearly)</Label>
                  </div>
                  <Button onClick={handleCreate} className="w-full" disabled={createHoliday.isPending}>Add Holiday</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : !sorted.length ? (
        <EmptyState
          icon={<CalendarDays className="size-7" />} title="No holidays configured"
          description="Add national holidays and company holidays."
          action={canCreate ? <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}><Plus className="mr-1 h-4 w-4" />Add holiday</Button> : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {sorted.map((h: any) => (
            <Card key={h.id}>
              <CardContent className="pt-4 flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">{h.name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    {h.date}
                    {h.isRecurring && <Badge variant="outline" className="text-xs">Yearly</Badge>}
                  </div>
                </div>
                {canDelete && (
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(h.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Bulk Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Import Holidays</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              One entry per line: <code>YYYY-MM-DD, Holiday Name</code>
            </p>
            <textarea
              className="w-full h-40 rounded-md border p-2 text-sm font-mono"
              placeholder="2026-01-01, Tahun Baru&#10;2026-03-20, Hari Raya Nyepi&#10;2026-05-01, Hari Buruh"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
            />
            <Button onClick={handleBulkImport} className="w-full" disabled={importBulk.isPending}>
              Import
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
