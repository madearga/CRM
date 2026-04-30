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

const convexApi = api as any;

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const canEdit = usePermission('hr_employees', 'edit');

  const { data: employee, isLoading } = useAuthQuery(
    convexApi.hrEmployees.getById,
    { id },
  );

  const { data: attendanceHistory } = useAuthQuery(
    convexApi.hrAttendance.getByEmployee,
    employee ? { employeeId: id } : 'skip',
  );

  const updateEmployee = useAuthMutation(convexApi.hrEmployees.update);
  const updateStatus = useAuthMutation(convexApi.hrEmployees.updateStatus);

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
