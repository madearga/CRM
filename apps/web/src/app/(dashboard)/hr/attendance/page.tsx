'use client';

import { useState, useMemo } from 'react';
import { useAuthQuery } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Search, Clock } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { NoResults } from '@/components/no-results';
import { DataTable, DataTableSkeleton } from '@/components/data-table';
import { getColumns, type AttendanceRow } from './columns';
import { usePermission } from '@/lib/permissions/use-permission';

export default function AttendancePage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');

  const canView = usePermission('hr_attendance', 'view');

  const { data: report, isLoading } = useAuthQuery(
    (api as any).hrReports.getAttendanceReport,
    {},
  );
  const { data: branches } = useAuthQuery((api as any).hrBranches.list, {});

  const rows: AttendanceRow[] = useMemo(() => {
    let filtered = report ?? [];
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((r: any) => (r.employeeName ?? '').toLowerCase().includes(q));
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter((r: any) => r.status === statusFilter);
    }
    if (branchFilter !== 'all') {
      filtered = filtered.filter((r: any) => r.branchId === branchFilter);
    }
    return filtered.map((r: any) => ({
      id: r.id ?? r.employeeId + r.date,
      date: r.date,
      employeeName: r.employeeName ?? 'Unknown',
      branchName: r.branchName,
      clockIn: r.clockIn ? new Date(r.clockIn).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : null,
      clockOut: r.clockOut ? new Date(r.clockOut).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : null,
      status: r.status,
      label: r.label,
      lateMinutes: r.lateMinutes,
      totalWorkHours: r.totalWorkHours,
    }));
  }, [report, search, statusFilter, branchFilter]);

  const columns = useMemo(() => getColumns(), []);

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        You don't have permission to view attendance.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Attendance</h1>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search employee..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="present">Hadir</SelectItem>
            <SelectItem value="absent">Alpha</SelectItem>
            <SelectItem value="on_leave">Cuti</SelectItem>
            <SelectItem value="holiday">Libur</SelectItem>
          </SelectContent>
        </Select>
        <Select value={branchFilter} onValueChange={setBranchFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Branches</SelectItem>
            {(branches ?? []).map((b: any) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <DataTableSkeleton columns={[
          { type: 'text', width: 'w-24' }, { type: 'text', width: 'w-32' },
          { type: 'text', width: 'w-16' }, { type: 'text', width: 'w-16' },
          { type: 'badge' }, { type: 'text', width: 'w-24' }, { type: 'text', width: 'w-12' },
        ]} />
      ) : search && !rows.length ? (
        <NoResults searchQuery={search} onClear={() => setSearch('')} />
      ) : !rows.length ? (
        <EmptyState
          icon={<Clock className="size-7" />} title="No attendance records"
          description="Attendance will appear here once employees start clocking in."
        />
      ) : (
        <DataTable columns={columns} data={rows} />
      )}
    </div>
  );
}
