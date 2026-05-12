'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthQuery, useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { usePermission } from '@/lib/permissions/use-permission';

export default function EmployeeCreatePage() {
  const { push } = useRouter();
  const canCreate = usePermission('hr_employees', 'create');

  const [form, setForm] = useState({
    name: '', nik: '', position: '', department: '', phone: '', email: '',
    whatsappNumber: '', branchId: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: branches } = useAuthQuery(
    (api as any).hrBranches.list,
    {},
  );

  const createEmployee = useAuthMutation((api as any).hrEmployees.create);

  const setField = (field: string, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    if (errors[field]) {
      setErrors((p) => {
        const next = { ...p };
        delete next[field];
        return next;
      });
    }
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = 'Name is required';
    if (!form.nik.trim()) next.nik = 'NIK is required';
    if (!form.branchId) next.branchId = 'Branch is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      await createEmployee.mutateAsync({
        name: form.name.trim(),
        nik: form.nik.trim(),
        position: form.position.trim() || undefined,
        department: form.department || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        whatsappNumber: form.whatsappNumber || undefined,
        branchId: form.branchId,
      } as any);
      toast.success(`Employee "${form.name.trim()}" created`);
      push('/hr/employees');
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to create employee');
    }
  };

  if (!canCreate) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        You don't have permission to create employees.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => push('/hr/employees')}>
          <ArrowLeft className="mr-1 h-4 w-4" />Back
        </Button>
        <h1 className="text-2xl font-bold">Add Employee</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Employee Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  placeholder="Full name"
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                />
                {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="nik">NIK *</Label>
                <Input
                  id="nik"
                  placeholder="NIK"
                  value={form.nik}
                  onChange={(e) => setField('nik', e.target.value)}
                />
                {errors.nik && <p className="text-xs text-red-500">{errors.nik}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="position">Position</Label>
                <Input
                  id="position"
                  placeholder="Position"
                  value={form.position}
                  onChange={(e) => setField('position', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  placeholder="Department"
                  value={form.department}
                  onChange={(e) => setField('department', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  placeholder="Phone number"
                  value={form.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Email address"
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="whatsappNumber">WhatsApp Number</Label>
                <Input
                  id="whatsappNumber"
                  placeholder="WhatsApp number"
                  value={form.whatsappNumber}
                  onChange={(e) => setField('whatsappNumber', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branchId">Branch *</Label>
                <Select value={form.branchId} onValueChange={(v) => setField('branchId', v)}>
                  <SelectTrigger id="branchId">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {(branches ?? []).map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.branchId && <p className="text-xs text-red-500">{errors.branchId}</p>}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => push('/hr/employees')}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createEmployee.isPending}>
                {createEmployee.isPending ? 'Creating...' : 'Create Employee'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
