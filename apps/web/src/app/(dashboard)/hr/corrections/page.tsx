'use client';

import { useMemo } from 'react';
import { useAuthQuery, useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { EmptyState } from '@/components/empty-state';
import { DataTable, DataTableSkeleton } from '@/components/data-table';
import { getColumns, type CorrectionRow } from './columns';
import { ClipboardCheck } from 'lucide-react';
import { toast } from 'sonner';
import { usePermission } from '@/lib/permissions/use-permission';

export default function CorrectionsPage() {
  const canView = usePermission('hr_attendance', 'view');
  const canManage = usePermission('hr_attendance', 'manage');

  const { data: corrections, isLoading } = useAuthQuery(
    (api as any).hrCorrections.listPending,
    {},
  );

  const review = useAuthMutation((api as any).hrCorrections.review);

  const handleApprove = async (id: string) => {
    try {
      await review.mutateAsync({ id, action: 'approve' } as any);
      toast.success('Correction approved');
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to approve');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await review.mutateAsync({ id, action: 'reject' } as any);
      toast.success('Correction rejected');
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to reject');
    }
  };

  const rows: CorrectionRow[] = useMemo(
    () => (corrections ?? []).map((c: any) => ({
      id: c.id,
      employeeName: c.employeeName ?? 'Unknown',
      date: c.date ?? '—',
      correctedClockIn: c.correctedClockIn ? new Date(c.correctedClockIn).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : null,
      correctedClockOut: c.correctedClockOut ? new Date(c.correctedClockOut).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : null,
      reason: c.reason,
      status: c.status,
    })),
    [corrections],
  );

  const columns = useMemo(() => getColumns({
    onApprove: handleApprove,
    onReject: handleReject,
  }), []);

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        You don't have permission to view corrections.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Attendance Corrections</h1>

      {isLoading ? (
        <DataTableSkeleton columns={[
          { type: 'text', width: 'w-32' }, { type: 'text', width: 'w-24' },
          { type: 'text', width: 'w-40' }, { type: 'text', width: 'w-16' },
          { type: 'text', width: 'w-16' }, { type: 'badge' }, { type: 'text', width: 'w-16' },
        ]} />
      ) : !rows.length ? (
        <EmptyState
          icon={<ClipboardCheck className="size-7" />} title="No pending corrections"
          description="Correction requests from employees will appear here."
        />
      ) : (
        <DataTable columns={columns} data={rows} />
      )}
    </div>
  );
}
