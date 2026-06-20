# HR Module V1 — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build all frontend pages for the HR module — dashboard, employees, branches, shifts, attendance, corrections, holidays, and reports.

**Architecture:** Next.js 16 App Router pages under `apps/web/src/app/(dashboard)/hr/...`. Each page uses Convex hooks (`useAuthQuery`, `useAuthPaginatedQuery`, `useAuthMutation`, `useAuthAction`) and shadcn/ui components. Permission checks via `usePermission()`. Follows existing CRM page patterns (companies, contacts).

**Tech Stack:** Next.js 16, shadcn/ui, TanStack React Query, Convex, lucide-react

---

## Scope

This plan covers frontend Tasks 11-20 only. Backend Tasks 1-10 are committed and deployed. All Convex API functions exist and return typed output.

## Frontend File Structure

```
apps/web/src/
├── app/(dashboard)/
│   ├── layout.tsx                              # ADD HR nav items + featureMap entries
│   └── hr/
│       ├── page.tsx                            # HR Dashboard
│       ├── branches/
│       │   ├── page.tsx                        # Branch list + CRUD
│       │   └── columns.tsx                     # Branch table columns
│       ├── employees/
│       │   ├── page.tsx                        # Employee list + CRUD
│       │   ├── columns.tsx                     # Employee table columns
│       │   └── [id]/
│       │       └── page.tsx                    # Employee detail + attendance history
│       ├── shifts/
│       │   ├── page.tsx                        # Shift definitions + CRUD
│       │   └── columns.tsx                     # Shift table columns
│       ├── assignments/
│       │   └── page.tsx                        # Shift assignments + schedule
│       ├── attendance/
│       │   ├── page.tsx                        # Daily attendance view
│       │   └── columns.tsx                     # Attendance table columns
│       ├── corrections/
│       │   ├── page.tsx                        # Correction review list
│       │   └── columns.tsx                     # Correction table columns
│       ├── holidays/
│       │   └── page.tsx                        # Holiday CRUD + bulk import
│       └── reports/
│           └── page.tsx                        # Reports + CSV export
├── lib/
│   └── permission-constants.ts                 # ADD HR features/actions
└── hooks/
    └── use-hr-params.ts                        # Shared URL param hooks for HR pages
```

---

### Task 11: Navigation and Permission Constants

**Files:**
- Modify: `/Users/madearga/Desktop/CRM/apps/web/src/app/(dashboard)/layout.tsx`
- Modify: `/Users/madearga/Desktop/CRM/apps/web/src/lib/permission-constants.ts`

- [ ] **Step 1: Add HR features to frontend permission constants**

In `/Users/madearga/Desktop/CRM/apps/web/src/lib/permission-constants.ts`, add HR entries to match the backend `permissionHelpers.ts`. The file mirrors backend constants for frontend use.

Add these entries to the `FEATURES` array (after `'activities'`):

```typescript
  'hr_employees',
  'hr_attendance',
  'hr_shifts',
  'hr_reports',
  'hr_branches',
  'hr_holidays',
```

Add `'export'` to the `ACTIONS` array (after `'manage_roles'`):

```typescript
  'export',
```

Add these entries to the `FEATURE_ACTIONS` record (after `activities`):

```typescript
  hr_employees: ['view', 'create', 'edit', 'delete'],
  hr_attendance: ['view', 'edit', 'manage'],
  hr_shifts: ['view', 'create', 'edit', 'delete'],
  hr_reports: ['view', 'export'],
  hr_branches: ['view', 'create', 'edit', 'delete'],
  hr_holidays: ['view', 'create', 'delete'],
```

Also update the `buildDefaultEntries` function and any other places in this file that iterate over FEATURES/ACTIONS — they should pick up the new entries automatically since they derive from the arrays.

- [ ] **Step 2: Add HR nav items to dashboard layout**

In `/Users/madearga/Desktop/CRM/apps/web/src/app/(dashboard)/layout.tsx`, first add the import for the HR icon at the top with the other lucide imports:

```typescript
import { UsersRound } from 'lucide-react';
```

Then in the `navItems` array, add after the `Activities` entry (before `Settings`):

```typescript
  { title: 'HR', href: '/hr', icon: UsersRound },
```

In the `featureMap` record, add after the `/activities` entry:

```typescript
  '/hr': 'hr_employees',
  '/hr/employees': 'hr_employees',
  '/hr/branches': 'hr_branches',
  '/hr/shifts': 'hr_shifts',
  '/hr/assignments': 'hr_shifts',
  '/hr/attendance': 'hr_attendance',
  '/hr/corrections': 'hr_attendance',
  '/hr/holidays': 'hr_holidays',
  '/hr/reports': 'hr_reports',
```

- [ ] **Step 3: Verify TypeScript compilation**

Run: `cd /Users/madearga/Desktop/CRM && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -20`

Expected: No errors related to layout.tsx or permission-constants.ts. (Pre-existing errors in other files are acceptable.)

- [ ] **Step 4: Commit**

```bash
cd /Users/madearga/Desktop/CRM
git add apps/web/src/app/\(dashboard\)/layout.tsx apps/web/src/lib/permission-constants.ts
git commit -m "feat(hr): add navigation items and permission constants for HR module"
```

---

### Task 12: HR Dashboard Page

**Files:**
- Create: `/Users/madearga/Desktop/CRM/apps/web/src/app/(dashboard)/hr/page.tsx`

- [ ] **Step 1: Create HR dashboard page**

Create `/Users/madearga/Desktop/CRM/apps/web/src/app/(dashboard)/hr/page.tsx`:

```tsx
'use client';

import { useAuthQuery } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Clock, AlertTriangle, TrendingUp, CalendarDays, Building2 } from 'lucide-react';
import { usePermission } from '@/lib/permissions/use-permission';

export default function HRDashboardPage() {
  const canView = usePermission('hr_employees', 'view');
  const canViewAttendance = usePermission('hr_attendance', 'view');

  const { data: dailySummary, isLoading: loadingSummary } = useAuthQuery(
    api.hrAttendance.getDailySummary as any,
    {},
  );

  const { data: monthlySummary, isLoading: loadingMonthly } = useAuthQuery(
    api.hrReports.getMonthlySummary as any,
    {},
  );

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        You don't have permission to view the HR dashboard.
      </div>
    );
  }

  const todayStats = Array.isArray(dailySummary)
    ? dailySummary.reduce(
        (acc: { total: number; present: number; late: number; absent: number }, branch: any) => ({
          total: acc.total + branch.total,
          present: acc.present + branch.present,
          late: acc.late + branch.late,
          absent: acc.absent + branch.absent,
        }),
        { total: 0, present: 0, late: 0, absent: 0 },
      )
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">HR Dashboard</h1>
        <p className="text-muted-foreground">Overview of attendance and workforce</p>
      </div>

      {/* Today's Summary */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Today's Attendance</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Employees"
            value={todayStats?.total}
            icon={<Users className="h-4 w-4 text-muted-foreground" />}
            loading={loadingSummary}
          />
          <StatCard
            title="Present"
            value={todayStats?.present}
            icon={<Clock className="h-4 w-4 text-green-600" />}
            loading={loadingSummary}
          />
          <StatCard
            title="Late"
            value={todayStats?.late}
            icon={<AlertTriangle className="h-4 w-4 text-yellow-600" />}
            loading={loadingSummary}
          />
          <StatCard
            title="Absent"
            value={todayStats?.absent}
            icon={<AlertTriangle className="h-4 w-4 text-red-600" />}
            loading={loadingSummary}
          />
        </div>
      </div>

      {/* Branch Breakdown */}
      {Array.isArray(dailySummary) && dailySummary.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">By Branch</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dailySummary.map((branch: any) => (
              <Card key={branch.branchId}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Branch
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <div>
                      <div className="font-semibold text-green-600">{branch.present}</div>
                      <div className="text-xs text-muted-foreground">Present</div>
                    </div>
                    <div>
                      <div className="font-semibold text-yellow-600">{branch.late}</div>
                      <div className="text-xs text-muted-foreground">Late</div>
                    </div>
                    <div>
                      <div className="font-semibold text-red-600">{branch.absent}</div>
                      <div className="text-xs text-muted-foreground">Absent</div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground text-right">
                    Total: {branch.total}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Monthly Summary */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Monthly Summary</h2>
        {loadingMonthly ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : Array.isArray(monthlySummary) && monthlySummary.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {monthlySummary.slice(0, 6).map((emp: any) => (
              <Card key={emp.employeeId}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{emp.name}</div>
                      <div className="text-xs text-muted-foreground">{emp.department ?? 'No Dept'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{emp.attendanceRate}%</div>
                      <div className="text-xs text-muted-foreground">attendance</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No attendance data yet for this month.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  loading,
}: {
  title: string;
  value?: number;
  icon: React.ReactNode;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className="text-2xl font-bold">{value ?? 0}</div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify the page renders without type errors**

Run: `cd /Users/madearga/Desktop/CRM && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep "hr/page" || echo "No HR page errors"`

Expected: "No HR page errors" or no output matching hr/page.

- [ ] **Step 3: Commit**

```bash
cd /Users/madearga/Desktop/CRM
git add apps/web/src/app/\(dashboard\)/hr/page.tsx
git commit -m "feat(hr): add HR dashboard page with attendance widgets and monthly summary"
```

---

### Task 13: Branch Management Page

**Files:**
- Create: `/Users/madearga/Desktop/CRM/apps/web/src/app/(dashboard)/hr/branches/page.tsx`
- Create: `/Users/madearga/Desktop/CRM/apps/web/src/app/(dashboard)/hr/branches/columns.tsx`

- [ ] **Step 1: Create branch table columns**

Create `/Users/madearga/Desktop/CRM/apps/web/src/app/(dashboard)/hr/branches/columns.tsx`:

```tsx
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, QrCode } from 'lucide-react';

export type BranchRow = {
  id: string;
  name: string;
  address: string | null | undefined;
  phone: string | null | undefined;
  qrCode: string;
  isActive: boolean;
  createdAt: number;
};

export function getColumns(opts: {
  onRegenerateQr: (id: string) => void;
}): ColumnDef<BranchRow>[] {
  return [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <Button variant="ghost" size="sm" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Name <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
    },
    {
      accessorKey: 'address',
      header: 'Address',
      cell: ({ row }) => row.original.address ?? '—',
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      cell: ({ row }) => row.original.phone ?? '—',
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? 'default' : 'secondary'}>
          {row.original.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => opts.onRegenerateQr(row.original.id)}
          title="Regenerate QR Code"
        >
          <QrCode className="h-4 w-4" />
        </Button>
      ),
    },
  ];
}
```

- [ ] **Step 2: Create branch management page**

Create `/Users/madearga/Desktop/CRM/apps/web/src/app/(dashboard)/hr/branches/page.tsx`:

```tsx
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
    api.hrBranches.list as any,
    { includeInactive: true },
  );

  const createBranch = useAuthMutation(api.hrBranches.create as any);
  const updateBranch = useAuthMutation(api.hrBranches.update as any);
  const regenerateQr = useAuthMutation(api.hrBranches.regenerateQr as any);

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
```

- [ ] **Step 3: Verify no type errors**

Run: `cd /Users/madearga/Desktop/CRM && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep "hr/branches" || echo "No branch page errors"`

Expected: "No branch page errors"

- [ ] **Step 4: Commit**

```bash
cd /Users/madearga/Desktop/CRM
git add apps/web/src/app/\(dashboard\)/hr/branches/
git commit -m "feat(hr): add branch management page with CRUD and QR regeneration"
```

---

### Task 14: Employee List Page

**Files:**
- Create: `/Users/madearga/Desktop/CRM/apps/web/src/app/(dashboard)/hr/employees/page.tsx`
- Create: `/Users/madearga/Desktop/CRM/apps/web/src/app/(dashboard)/hr/employees/columns.tsx`

- [ ] **Step 1: Create employee table columns**

Create `/Users/madearga/Desktop/CRM/apps/web/src/app/(dashboard)/hr/employees/columns.tsx`:

```tsx
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUpDown } from 'lucide-react';

const statusLabels: Record<string, string> = {
  active: 'Aktif',
  on_leave: 'Cuti',
  resigned: 'Resign',
};

const statusColors: Record<string, 'default' | 'secondary' | 'destructive'> = {
  active: 'default',
  on_leave: 'secondary',
  resigned: 'destructive',
};

export type EmployeeRow = {
  id: string;
  name: string;
  nik: string;
  position: string;
  department: string | null | undefined;
  branchName?: string;
  status: string;
  phone: string | null | undefined;
  whatsappNumber: string | null | undefined;
};

export function getColumns(): ColumnDef<EmployeeRow>[] {
  return [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <Button variant="ghost" size="sm" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Name <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
    },
    {
      accessorKey: 'nik',
      header: 'NIK',
    },
    {
      accessorKey: 'position',
      header: 'Position',
    },
    {
      accessorKey: 'department',
      header: 'Department',
      cell: ({ row }) => row.original.department ?? '—',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={statusColors[row.original.status] ?? 'secondary'}>
          {statusLabels[row.original.status] ?? row.original.status}
        </Badge>
      ),
    },
  ];
}
```

- [ ] **Step 2: Create employee list page**

Create `/Users/madearga/Desktop/CRM/apps/web/src/app/(dashboard)/hr/employees/page.tsx`:

```tsx
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
    api.hrEmployees.list as any,
    {},
  );

  const { data: branches } = useAuthQuery(
    api.hrBranches.list as any,
    {},
  );

  const createEmployee = useAuthMutation(api.hrEmployees.create as any);

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
```

- [ ] **Step 3: Verify no type errors**

Run: `cd /Users/madearga/Desktop/CRM && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep "hr/employees" || echo "No employee page errors"`

Expected: "No employee page errors"

- [ ] **Step 4: Commit**

```bash
cd /Users/madearga/Desktop/CRM
git add apps/web/src/app/\(dashboard\)/hr/employees/
git commit -m "feat(hr): add employee list page with filters and create dialog"
```

---

### Task 15: Employee Detail Page

**Files:**
- Create: `/Users/madearga/Desktop/CRM/apps/web/src/app/(dashboard)/hr/employees/[id]/page.tsx`

- [ ] **Step 1: Create employee detail page**

Create `/Users/madearga/Desktop/CRM/apps/web/src/app/(dashboard)/hr/employees/[id]/page.tsx`:

```tsx
'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthQuery, useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Edit2, User, Phone, Mail, MapPin, Briefcase, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { usePermission } from '@/lib/permissions/use-permission';

const statusLabels: Record<string, string> = {
  active: 'Aktif',
  on_leave: 'Cuti',
  resigned: 'Resign',
};

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const canEdit = usePermission('hr_employees', 'edit');

  const { data: employee, isLoading } = useAuthQuery(
    api.hrEmployees.getById as any,
    { id },
  );

  const { data: attendanceHistory } = useAuthQuery(
    api.hrAttendance.getByEmployee as any,
    employee ? { employeeId: id } : 'skip',
  );

  const updateEmployee = useAuthMutation(api.hrEmployees.update as any);
  const updateStatus = useAuthMutation(api.hrEmployees.updateStatus as any);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        Employee not found.
        <Button variant="link" onClick={() => router.push('/hr/employees')}>Back to list</Button>
      </div>
    );
  }

  const last30Days = (attendanceHistory ?? []).slice(0, 30);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/hr/employees')}>
          <ArrowLeft className="mr-1 h-4 w-4" />Back
        </Button>
        <h1 className="text-2xl font-bold">{employee.name}</h1>
        <Badge>{statusLabels[employee.status] ?? employee.status}</Badge>
        {canEdit && (
          <StatusSelect
            current={employee.status}
            onChange={async (status) => {
              try {
                await updateStatus.mutateAsync({ id, status } as any);
                toast.success(`Status updated to ${statusLabels[status] ?? status}`);
              } catch (e: any) {
                toast.error(e.data?.message ?? 'Failed to update status');
              }
            }}
          />
        )}
      </div>

      {/* Employee Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" /> Employee Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <InfoField icon={<Briefcase className="h-4 w-4" />} label="NIK" value={employee.nik} />
            <InfoField icon={<Briefcase className="h-4 w-4" />} label="Position" value={employee.position} />
            <InfoField icon={<MapPin className="h-4 w-4" />} label="Department" value={employee.department ?? '—'} />
            <InfoField icon={<Phone className="h-4 w-4" />} label="Phone" value={employee.phone ?? '—'} />
            <InfoField icon={<Mail className="h-4 w-4" />} label="Email" value={employee.email ?? '—'} />
            <InfoField icon={<Phone className="h-4 w-4" />} label="WhatsApp" value={employee.whatsappNumber ?? '—'} />
            <InfoField icon={<Calendar className="h-4 w-4" />} label="Hire Date" value={employee.hireDate ? new Date(employee.hireDate).toLocaleDateString('id-ID') : '—'} />
            <InfoField icon={<Calendar className="h-4 w-4" />} label="Resign Date" value={employee.resignDate ? new Date(employee.resignDate).toLocaleDateString('id-ID') : '—'} />
          </div>
        </CardContent>
      </Card>

      {/* Attendance History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" /> Attendance History (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {last30Days.length === 0 ? (
            <p className="text-sm text-muted-foreground">No attendance records found.</p>
          ) : (
            <div className="space-y-2">
              {last30Days.map((record: any) => (
                <div key={record.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div className="text-sm">
                    <span className="font-medium">{record.date}</span>
                    {record.label && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        {record.label.replace(/_/g, ' ')}
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {record.clockIn ? new Date(record.clockIn).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    {' → '}
                    {record.clockOut ? new Date(record.clockOut).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    {record.totalWorkHours != null && (
                      <span className="ml-2">({record.totalWorkHours}h)</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-medium">{value}</div>
      </div>
    </div>
  );
}

function StatusSelect({ current, onChange }: { current: string; onChange: (status: string) => void }) {
  return (
    <Select value={current} onValueChange={onChange}>
      <SelectTrigger className="w-28 h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="active">Aktif</SelectItem>
        <SelectItem value="on_leave">Cuti</SelectItem>
        <SelectItem value="resigned">Resign</SelectItem>
      </SelectContent>
    </Select>
  );
}
```

- [ ] **Step 2: Verify no type errors**

Run: `cd /Users/madearga/Desktop/CRM && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep "hr/employees/\[id\]" || echo "No errors"`

Expected: "No errors"

- [ ] **Step 3: Commit**

```bash
cd /Users/madearga/Desktop/CRM
git add apps/web/src/app/\(dashboard\)/hr/employees/\[id\]/
git commit -m "feat(hr): add employee detail page with attendance history"
```

---

### Task 16: Shift Management Page

**Files:**
- Create: `/Users/madearga/Desktop/CRM/apps/web/src/app/(dashboard)/hr/shifts/page.tsx`
- Create: `/Users/madearga/Desktop/CRM/apps/web/src/app/(dashboard)/hr/shifts/columns.tsx`

- [ ] **Step 1: Create shift table columns**

Create `/Users/madearga/Desktop/CRM/apps/web/src/app/(dashboard)/hr/shifts/columns.tsx`:

```tsx
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, Trash2 } from 'lucide-react';

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export type ShiftRow = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  lateToleranceMinutes: number;
  daysOfWeek: number[];
  branchName?: string;
};

export function getColumns(opts: {
  onDelete: (id: string) => void;
}): ColumnDef<ShiftRow>[] {
  return [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <Button variant="ghost" size="sm" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Shift Name <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
    },
    {
      id: 'time',
      header: 'Time',
      cell: ({ row }) => `${row.original.startTime} — ${row.original.endTime}`,
    },
    {
      accessorKey: 'lateToleranceMinutes',
      header: 'Tolerance',
      cell: ({ row }) => `${row.original.lateToleranceMinutes} min`,
    },
    {
      accessorKey: 'daysOfWeek',
      header: 'Days',
      cell: ({ row }) => (
        <div className="flex gap-1 flex-wrap">
          {row.original.daysOfWeek.map((d) => (
            <Badge key={d} variant="outline" className="text-xs">{dayNames[d]}</Badge>
          ))}
        </div>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" onClick={() => opts.onDelete(row.original.id)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      ),
    },
  ];
}
```

- [ ] **Step 2: Create shift management page**

Create `/Users/madearga/Desktop/CRM/apps/web/src/app/(dashboard)/hr/shifts/page.tsx`:

```tsx
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

  const { data: shifts, isLoading } = useAuthQuery(api.hrShifts.list as any, {});
  const { data: branches } = useAuthQuery(api.hrBranches.list as any, {});

  const createShift = useAuthMutation(api.hrShifts.create as any);
  const removeShift = useAuthMutation(api.hrShifts.remove as any);

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
```

- [ ] **Step 3: Verify no type errors**

Run: `cd /Users/madearga/Desktop/CRM && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep "hr/shifts" || echo "No errors"`

Expected: "No errors"

- [ ] **Step 4: Commit**

```bash
cd /Users/madearga/Desktop/CRM
git add apps/web/src/app/\(dashboard\)/hr/shifts/
git commit -m "feat(hr): add shift management page with CRUD and day picker"
```

---

### Task 17: Shift Assignment Page

**Files:**
- Create: `/Users/madearga/Desktop/CRM/apps/web/src/app/(dashboard)/hr/assignments/page.tsx`

- [ ] **Step 1: Create shift assignment page**

Create `/Users/madearga/Desktop/CRM/apps/web/src/app/(dashboard)/hr/assignments/page.tsx`:

```tsx
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
    api.hrShiftAssignments.getSchedule as any,
    {},
  );
  const { data: employees } = useAuthQuery(api.hrEmployees.list as any, {});
  const { data: shifts } = useAuthQuery(api.hrShifts.list as any, {});
  const { data: branches } = useAuthQuery(api.hrBranches.list as any, {});

  const assignShift = useAuthMutation(api.hrShiftAssignments.assign as any);
  const removeAssignment = useAuthMutation(api.hrShiftAssignments.remove as any);

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
                    <label className="text-xs text-muted-foreground">Start Date *</label>
                    <Input type="date" value={assignment.startDate} onChange={(e) => setAssignment((p) => ({ ...p, startDate: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">End Date</label>
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
```

- [ ] **Step 2: Verify no type errors**

Run: `cd /Users/madearga/Desktop/CRM && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep "hr/assignments" || echo "No errors"`

Expected: "No errors"

- [ ] **Step 3: Commit**

```bash
cd /Users/madearga/Desktop/CRM
git add apps/web/src/app/\(dashboard\)/hr/assignments/
git commit -m "feat(hr): add shift assignment page with weekly/once assignment"
```

---

### Task 18: Attendance Page

**Files:**
- Create: `/Users/madearga/Desktop/CRM/apps/web/src/app/(dashboard)/hr/attendance/page.tsx`
- Create: `/Users/madearga/Desktop/CRM/apps/web/src/app/(dashboard)/hr/attendance/columns.tsx`

- [ ] **Step 1: Create attendance table columns**

Create `/Users/madearga/Desktop/CRM/apps/web/src/app/(dashboard)/hr/attendance/columns.tsx`:

```tsx
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUpDown } from 'lucide-react';

const statusLabels: Record<string, string> = {
  present: 'Hadir',
  absent: 'Alpha',
  on_leave: 'Cuti',
  holiday: 'Libur',
};

const labelDisplay: Record<string, string> = {
  on_time: 'Tepat Waktu',
  late: 'Terlambat',
  early_leave: 'Pulang Awal',
  no_shift: 'Tanpa Shift',
  forgot_clockout: 'Lupa Checkout',
  outside_area: 'Luar Area',
};

export type AttendanceRow = {
  id: string;
  date: string;
  employeeName: string;
  branchName?: string;
  clockIn: string | null;
  clockOut: string | null;
  status: string;
  label: string | null;
  lateMinutes: number | null;
  totalWorkHours: number | null;
};

export function getColumns(): ColumnDef<AttendanceRow>[] {
  return [
    {
      accessorKey: 'date',
      header: ({ column }) => (
        <Button variant="ghost" size="sm" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Date <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
    },
    {
      accessorKey: 'employeeName',
      header: 'Employee',
    },
    {
      accessorKey: 'clockIn',
      header: 'Clock In',
      cell: ({ row }) => row.original.clockIn ?? '—',
    },
    {
      accessorKey: 'clockOut',
      header: 'Clock Out',
      cell: ({ row }) => row.original.clockOut ?? '—',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.status === 'present' ? 'default' : row.original.status === 'absent' ? 'destructive' : 'secondary'}>
          {statusLabels[row.original.status] ?? row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'label',
      header: 'Label',
      cell: ({ row }) =>
        row.original.label ? (
          <Badge variant="outline" className="text-xs">{labelDisplay[row.original.label] ?? row.original.label}</Badge>
        ) : null,
    },
    {
      accessorKey: 'totalWorkHours',
      header: 'Hours',
      cell: ({ row }) => (row.original.totalWorkHours != null ? `${row.original.totalWorkHours}h` : '—'),
    },
  ];
}
```

- [ ] **Step 2: Create attendance page**

Create `/Users/madearga/Desktop/CRM/apps/web/src/app/(dashboard)/hr/attendance/page.tsx`:

```tsx
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
    api.hrReports.getAttendanceReport as any,
    {},
  );
  const { data: branches } = useAuthQuery(api.hrBranches.list as any, {});

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
```

- [ ] **Step 3: Verify no type errors**

Run: `cd /Users/madearga/Desktop/CRM && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep "hr/attendance" || echo "No errors"`

Expected: "No errors"

- [ ] **Step 4: Commit**

```bash
cd /Users/madearga/Desktop/CRM
git add apps/web/src/app/\(dashboard\)/hr/attendance/
git commit -m "feat(hr): add attendance page with filters and status display"
```

---

### Task 19: Corrections and Holidays Pages

**Files:**
- Create: `/Users/madearga/Desktop/CRM/apps/web/src/app/(dashboard)/hr/corrections/page.tsx`
- Create: `/Users/madearga/Desktop/CRM/apps/web/src/app/(dashboard)/hr/corrections/columns.tsx`
- Create: `/Users/madearga/Desktop/CRM/apps/web/src/app/(dashboard)/hr/holidays/page.tsx`

- [ ] **Step 1: Create corrections columns**

Create `/Users/madearga/Desktop/CRM/apps/web/src/app/(dashboard)/hr/corrections/columns.tsx`:

```tsx
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';

const statusLabels: Record<string, string> = {
  pending: 'Menunggu',
  approved: 'Disetujui',
  rejected: 'Ditolak',
};

export type CorrectionRow = {
  id: string;
  employeeName: string;
  date: string;
  correctedClockIn: string | null;
  correctedClockOut: string | null;
  reason: string;
  status: string;
};

export function getColumns(opts: {
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}): ColumnDef<CorrectionRow>[] {
  return [
    {
      accessorKey: 'employeeName',
      header: 'Employee',
    },
    {
      accessorKey: 'date',
      header: 'Date',
    },
    {
      accessorKey: 'reason',
      header: 'Reason',
    },
    {
      accessorKey: 'correctedClockIn',
      header: 'Corrected In',
      cell: ({ row }) => row.original.correctedClockIn ?? '—',
    },
    {
      accessorKey: 'correctedClockOut',
      header: 'Corrected Out',
      cell: ({ row }) => row.original.correctedClockOut ?? '—',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.status === 'approved' ? 'default' : row.original.status === 'rejected' ? 'destructive' : 'secondary'}>
          {statusLabels[row.original.status] ?? row.original.status}
        </Badge>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) =>
        row.original.status === 'pending' ? (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => opts.onApprove(row.original.id)} title="Approve">
              <Check className="h-4 w-4 text-green-600" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => opts.onReject(row.original.id)} title="Reject">
              <X className="h-4 w-4 text-red-600" />
            </Button>
          </div>
        ) : null,
    },
  ];
}
```

- [ ] **Step 2: Create corrections page**

Create `/Users/madearga/Desktop/CRM/apps/web/src/app/(dashboard)/hr/corrections/page.tsx`:

```tsx
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
    api.hrCorrections.listPending as any,
    {},
  );

  const review = useAuthMutation(api.hrCorrections.review as any);

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
```

- [ ] **Step 3: Create holidays page**

Create `/Users/madearga/Desktop/CRM/apps/web/src/app/(dashboard)/hr/holidays/page.tsx`:

```tsx
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

  const { data: holidays, isLoading } = useAuthQuery(api.hrHolidays.list as any, {});
  const createHoliday = useAuthMutation(api.hrHolidays.create as any);
  const removeHoliday = useAuthMutation(api.hrHolidays.remove as any);
  const importBulk = useAuthMutation(api.hrHolidays.importBulk as any);

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
```

- [ ] **Step 4: Verify no type errors**

Run: `cd /Users/madearga/Desktop/CRM && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep "hr/corrections\|hr/holidays" || echo "No errors"`

Expected: "No errors"

- [ ] **Step 5: Commit**

```bash
cd /Users/madearga/Desktop/CRM
git add apps/web/src/app/\(dashboard\)/hr/corrections/ apps/web/src/app/\(dashboard\)/hr/holidays/
git commit -m "feat(hr): add corrections review and holiday management pages"
```

---

### Task 20: Reports Page

**Files:**
- Create: `/Users/madearga/Desktop/CRM/apps/web/src/app/(dashboard)/hr/reports/page.tsx`

- [ ] **Step 1: Create reports page**

Create `/Users/madearga/Desktop/CRM/apps/web/src/app/(dashboard)/hr/reports/page.tsx`:

```tsx
'use client';

import { useState, useMemo } from 'react';
import { useAuthQuery, useAuthAction } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Download, FileSpreadsheet, Users, Clock, TrendingUp } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { DataTableExportButton } from '@/components/data-table-export-button';
import { toast } from 'sonner';
import { usePermission } from '@/lib/permissions/use-permission';

export default function ReportsPage() {
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const canView = usePermission('hr_reports', 'view');
  const canExport = usePermission('hr_reports', 'export');

  const { data: branches } = useAuthQuery(api.hrBranches.list as any, {});

  const { data: summary, isLoading } = useAuthQuery(
    api.hrReports.getMonthlySummary as any,
    {},
  );

  const exportCsv = useAuthAction(api.hrReports.exportCSV as any);

  const handleExport = async () => {
    try {
      const csv = await exportCsv.mutateAsync({
        month: month || undefined,
        branchId: branchFilter !== 'all' ? branchFilter : undefined,
      } as any);
      // Download CSV
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `attendance-report-${month}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('CSV exported');
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to export CSV');
    }
  };

  const filteredSummary = useMemo(() => {
    if (branchFilter === 'all') return summary ?? [];
    return (summary ?? []).filter((s: any) => s.branchId === branchFilter);
  }, [summary, branchFilter]);

  const totals = useMemo(() => {
    return filteredSummary.reduce(
      (acc: any, s: any) => ({
        totalEmployees: acc.totalEmployees + 1,
        avgAttendance: acc.avgAttendance + (s.attendanceRate ?? 0),
        avgLate: acc.avgLate + (s.avgLateMinutes ?? 0),
      }),
      { totalEmployees: 0, avgAttendance: 0, avgLate: 0 },
    );
  }, [filteredSummary]);

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        You don't have permission to view reports.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reports</h1>
        {canExport && (
          <Button size="sm" onClick={handleExport} disabled={exportCsv.isPending}>
            <Download className="mr-1 h-4 w-4" />Export CSV
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Users className="h-8 w-8 text-muted-foreground" />
            <div>
              <div className="text-2xl font-bold">{totals.totalEmployees}</div>
              <div className="text-xs text-muted-foreground">Employees</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-green-600" />
            <div>
              <div className="text-2xl font-bold">
                {totals.totalEmployees > 0 ? Math.round(totals.avgAttendance / totals.totalEmployees) : 0}%
              </div>
              <div className="text-xs text-muted-foreground">Avg Attendance</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Clock className="h-8 w-8 text-yellow-600" />
            <div>
              <div className="text-2xl font-bold">
                {totals.totalEmployees > 0 ? Math.round(totals.avgLate / totals.totalEmployees) : 0} min
              </div>
              <div className="text-xs text-muted-foreground">Avg Late</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Employee Breakdown */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-muted rounded animate-pulse" />
          ))}
        </div>
      ) : !filteredSummary.length ? (
        <EmptyState
          icon={<FileSpreadsheet className="size-7" />} title="No data for this period"
          description="Select a different month or branch."
        />
      ) : (
        <div className="border rounded-lg divide-y">
          <div className="grid grid-cols-5 gap-2 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
            <div>Employee</div>
            <div>Department</div>
            <div className="text-right">Attendance</div>
            <div className="text-right">Late</div>
            <div className="text-right">Hours</div>
          </div>
          {filteredSummary.map((s: any) => (
            <div key={s.employeeId} className="grid grid-cols-5 gap-2 px-4 py-3 text-sm items-center">
              <div className="font-medium">{s.name}</div>
              <div className="text-muted-foreground">{s.department ?? '—'}</div>
              <div className="text-right font-medium">{s.attendanceRate}%</div>
              <div className="text-right text-muted-foreground">{s.avgLateMinutes ?? 0} min</div>
              <div className="text-right text-muted-foreground">{s.totalWorkHours ?? 0}h</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify no type errors**

Run: `cd /Users/madearga/Desktop/CRM && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep "hr/reports" || echo "No errors"`

Expected: "No errors"

- [ ] **Step 3: Final full build verification**

Run: `cd /Users/madearga/Desktop/CRM && npx next build 2>&1 | tail -20`

Expected: Build succeeds or only shows pre-existing errors unrelated to HR.

- [ ] **Step 4: Commit**

```bash
cd /Users/madearga/Desktop/CRM
git add apps/web/src/app/\(dashboard\)/hr/reports/
git commit -m "feat(hr): add reports page with monthly summary and CSV export"
```

---

## Self-Review

### 1. Spec Coverage

| Spec Requirement | Task |
|-----------------|------|
| Employee CRUD + filters (branch, dept, status, search) | Task 14 |
| Employee profile + attendance 30d + shift | Task 15 |
| Branch CRUD + QR code | Task 13 |
| Shift definitions per branch | Task 16 |
| Shift assignment (single + weekly) | Task 17 |
| Attendance daily view + filters | Task 18 |
| Correction review (approve/reject) | Task 19 |
| Holiday CRUD + bulk import | Task 19 |
| HR Dashboard (today widget, monthly stats, branch comparison) | Task 12 |
| Reports + CSV export | Task 20 |
| Navigation + permissions | Task 11 |
| Role access (HR Admin vs Branch Manager) | All pages via `usePermission` |

### 2. Placeholder Scan

No TBD, TODO, "implement later", "follow pattern", or "add validation" found. All steps contain complete code.

### 3. Type Consistency

- All API references match backend function names: `hrBranches.list/create/update/regenerateQr`, `hrEmployees.list/getById/create/update/updateStatus`, `hrShifts.list/create/remove`, `hrShiftAssignments.assign/remove/getSchedule/getByEmployee`, `hrAttendance.getDailySummary/getByEmployee`, `hrCorrections.listPending/review`, `hrHolidays.list/create/remove/importBulk`, `hrReports.getMonthlySummary/getAttendanceReport/exportCSV`.
- All `as any` casts used for Convex function references (standard pattern in existing codebase for untyped API references).
- Employee status values: `'active'`, `'on_leave'`, `'resigned'` — consistent with backend `employeeStatusSchema`.
- Attendance status values: `'present'`, `'absent'`, `'on_leave'`, `'holiday'` — consistent with backend `attendanceStatusSchema`.
