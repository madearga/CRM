'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
import { UserPlus, Search } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { NoResults } from '@/components/no-results';
import { DataTable, DataTableSkeleton } from '@/components/data-table';
import { getColumns, type EmployeeRow } from './columns';
import { toast } from 'sonner';
import { usePermission } from '@/lib/permissions/use-permission';

export default function EmployeesPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newEmp, setNewEmp] = useState({
    name: '', nik: '', position: '', department: '', phone: '', email: '',
    whatsappNumber: '', branchId: '',
  });

  const canView = usePermission('hr_employees', 'view');
  const canCreate = usePermission('hr_employees', 'create');

  const { data: employees, isLoading } = useAuthQuery(
    (api as any).hrEmployees.list,
    {},
  );

  const { data: branches } = useAuthQuery(
    (api as any).hrBranches.list,
    {},
  );

  const createEmployee = useAuthMutation((api as any).hrEmployees.create);

  const rows: EmployeeRow[] = useMemo(() => {
    let filtered = employees ?? [];
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((e: any) =>
        e.name.toLowerCase().includes(q) || e.nik.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter((e: any) => e.status === statusFilter);
    }
    if (branchFilter !== 'all') {
      filtered = filtered.filter((e: any) => e.branchId === branchFilter);
    }
    return filtered.map((e: any) => ({
      id: e.id, name: e.name, nik: e.nik, position: e.position,
      department: e.department, status: e.status, phone: e.phone,
      whatsappNumber: e.whatsappNumber,
    }));
  }, [employees, search, statusFilter, branchFilter]);

  const columns = useMemo(() => getColumns(), []);

  const handleCreate = async () => {
    if (!newEmp.name.trim() || !newEmp.nik.trim() || !newEmp.position.trim() || !newEmp.branchId) {
      toast.error('Name, NIK, Position, and Branch are required');
      return;
    }
    try {
      await createEmployee.mutateAsync({
        name: newEmp.name.trim(),
        nik: newEmp.nik.trim(),
        position: newEmp.position.trim(),
        department: newEmp.department || undefined,
        phone: newEmp.phone || undefined,
        email: newEmp.email || undefined,
        whatsappNumber: newEmp.whatsappNumber || undefined,
        branchId: newEmp.branchId,
        status: 'active',
      } as any);
      toast.success(`Employee "${newEmp.name}" created`);
      setNewEmp({ name: '', nik: '', position: '', department: '', phone: '', email: '', whatsappNumber: '', branchId: '' });
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to create employee');
    }
  };

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        You don't have permission to view employees.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Employees</h1>
        {canCreate && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><UserPlus className="mr-1 h-4 w-4" />Add Employee</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Add Employee</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Full name *" value={newEmp.name} onChange={(e) => setNewEmp((p) => ({ ...p, name: e.target.value }))} />
                  <Input placeholder="NIK *" value={newEmp.nik} onChange={(e) => setNewEmp((p) => ({ ...p, nik: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Position *" value={newEmp.position} onChange={(e) => setNewEmp((p) => ({ ...p, position: e.target.value }))} />
                  <Input placeholder="Department" value={newEmp.department} onChange={(e) => setNewEmp((p) => ({ ...p, department: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Phone" value={newEmp.phone} onChange={(e) => setNewEmp((p) => ({ ...p, phone: e.target.value }))} />
                  <Input placeholder="Email" value={newEmp.email} onChange={(e) => setNewEmp((p) => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="WhatsApp Number" value={newEmp.whatsappNumber} onChange={(e) => setNewEmp((p) => ({ ...p, whatsappNumber: e.target.value }))} />
                  <Select value={newEmp.branchId} onValueChange={(v) => setNewEmp((p) => ({ ...p, branchId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Branch *" /></SelectTrigger>
                    <SelectContent>
                      {(branches ?? []).map((b: any) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCreate} className="w-full" disabled={createEmployee.isPending}>Create Employee</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or NIK..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Aktif</SelectItem>
            <SelectItem value="on_leave">Cuti</SelectItem>
            <SelectItem value="resigned">Resign</SelectItem>
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
          { type: 'text', width: 'w-32' }, { type: 'text', width: 'w-20' },
          { type: 'text', width: 'w-24' }, { type: 'text', width: 'w-20' },
          { type: 'badge' },
        ]} />
      ) : search && !rows.length ? (
        <NoResults searchQuery={search} onClear={() => setSearch('')} />
      ) : !rows.length ? (
        <EmptyState
          icon={<UserPlus className="size-7" />} title="No employees yet"
          description="Add your first employee to start managing HR."
          action={canCreate ? <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}><UserPlus className="mr-1 h-4 w-4" />Add employee</Button> : undefined}
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          onRowClick={(row) => router.push(`/hr/employees/${row.id}`)}
        />
      )}
    </div>
  );
}
