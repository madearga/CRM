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
