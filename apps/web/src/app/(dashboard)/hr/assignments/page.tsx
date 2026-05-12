'use client';

import { useState, useMemo } from 'react';
import { useAuthQuery, useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Calendar, Trash2 } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { usePermission } from '@/lib/permissions/use-permission';

export default function AssignmentsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignment, setAssignment] = useState({
    employeeId: '', shiftId: '', recurrenceType: 'weekly' as 'once' | 'weekly',
    daysOfWeek: [1, 2, 3, 4, 5], startDate: '', endDate: '',
  });

  const canView = usePermission('hr_shifts', 'view');
  const canCreate = usePermission('hr_shifts', 'create');

  const { data: assignments, isLoading } = useAuthQuery(
    (api as any).hrShiftAssignments.getSchedule,
    {},
  );
  const { data: employees } = useAuthQuery((api as any).hrEmployees.list, {});
  const { data: shifts } = useAuthQuery((api as any).hrShifts.list, {});
  const { data: branches } = useAuthQuery((api as any).hrBranches.list, {});

  const assignShift = useAuthMutation((api as any).hrShiftAssignments.assign);
  const removeAssignment = useAuthMutation((api as any).hrShiftAssignments.remove);

  const DAYS = [
    { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' }, { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' }, { value: 6, label: 'Sat' },
    { value: 0, label: 'Sun' },
  ];

  const handleAssign = async () => {
    if (!assignment.employeeId || !assignment.shiftId || !assignment.startDate) {
      toast.error('Employee, shift, and start date are required');
      return;
    }
    try {
      await assignShift.mutateAsync({
        employeeId: assignment.employeeId,
        shiftId: assignment.shiftId,
        recurrenceType: assignment.recurrenceType,
        daysOfWeek: assignment.recurrenceType === 'weekly' ? assignment.daysOfWeek : undefined,
        startDate: new Date(assignment.startDate).getTime(),
        endDate: assignment.endDate ? new Date(assignment.endDate).getTime() : undefined,
      } as any);
      toast.success('Shift assigned');
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to assign shift');
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await removeAssignment.mutateAsync({ id } as any);
      toast.success('Assignment removed');
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to remove assignment');
    }
  };

  const toggleDay = (day: number) => {
    setAssignment((p) => ({
      ...p,
      daysOfWeek: p.daysOfWeek.includes(day)
        ? p.daysOfWeek.filter((d) => d !== day)
        : [...p.daysOfWeek, day].sort(),
    }));
  };

  const activeEmployees = useMemo(
    () => (employees ?? []).filter((e: any) => e.status === 'active'),
    [employees],
  );

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        You don't have permission to view shift assignments.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Shift Assignments</h1>
        {canCreate && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-1 h-4 w-4" />Assign Shift</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Assign Shift</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Select value={assignment.employeeId} onValueChange={(v) => setAssignment((p) => ({ ...p, employeeId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Employee *" /></SelectTrigger>
                  <SelectContent>
                    {activeEmployees.map((e: any) => (
                      <SelectItem key={e.id} value={e.id}>{e.name} — {e.position}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={assignment.shiftId} onValueChange={(v) => setAssignment((p) => ({ ...p, shiftId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Shift *" /></SelectTrigger>
                  <SelectContent>
                    {(shifts ?? []).map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name} ({s.startTime}—{s.endTime})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={assignment.recurrenceType} onValueChange={(v) => setAssignment((p) => ({ ...p, recurrenceType: v as 'once' | 'weekly' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly (recurring)</SelectItem>
                    <SelectItem value="once">One-time</SelectItem>
                  </SelectContent>
                </Select>
                {assignment.recurrenceType === 'weekly' && (
                  <div className="flex gap-1 flex-wrap">
                    {DAYS.map((d) => (
                      <Button
                        key={d.value} type="button" size="sm"
                        variant={assignment.daysOfWeek.includes(d.value) ? 'default' : 'outline'}
                        onClick={() => toggleDay(d.value)}
                      >
                        {d.label}
                      </Button>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label id="label-start-date" className="text-xs text-muted-foreground">Start Date *</label>
                    <Input type="date" value={assignment.startDate} onChange={(e) => setAssignment((p) => ({ ...p, startDate: e.target.value }))} />
                  </div>
                  <div>
                    <label id="label-end-date" className="text-xs text-muted-foreground">End Date</label>
                    <Input type="date" value={assignment.endDate} onChange={(e) => setAssignment((p) => ({ ...p, endDate: e.target.value }))} />
                  </div>
                </div>
                <Button onClick={handleAssign} className="w-full" disabled={assignShift.isPending}>Assign</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6"><Skeleton className="h-20 w-full" /></CardContent>
            </Card>
          ))}
        </div>
      ) : !(assignments ?? []).length ? (
        <EmptyState
          icon={<Calendar className="size-7" />} title="No shift assignments"
          description="Assign employees to shifts to build schedules."
          action={canCreate ? <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}><Plus className="mr-1 h-4 w-4" />Assign shift</Button> : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(assignments ?? []).map((a: any) => (
            <Card key={a.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex justify-between items-center">
                  <span>{a.employeeName ?? 'Employee'}</span>
                  <Badge variant="outline">{a.recurrenceType}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-1">
                  <div><span className="text-muted-foreground">Shift:</span> {a.shiftName ?? 'N/A'}</div>
                  <div><span className="text-muted-foreground">Start:</span> {a.startDate ? new Date(a.startDate).toLocaleDateString('id-ID') : 'N/A'}</div>
                  {a.daysOfWeek && (
                    <div className="flex gap-1 flex-wrap">
                      {a.daysOfWeek.map((d: number) => (
                        <Badge key={d} variant="secondary" className="text-xs">
                          {DAYS.find((dd) => dd.value === d)?.label ?? d}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                {canCreate && (
                  <Button variant="ghost" size="sm" className="mt-2" onClick={() => handleRemove(a.id)}>
                    <Trash2 className="h-4 w-4 text-destructive mr-1" />Remove
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
