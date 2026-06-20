'use client';

import { useMemo, useState } from 'react';
import { useAuthAction, useAuthQuery } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  Users,
} from 'lucide-react';
import { AttendanceReportPDF, type AttendanceReportPDFData } from "@/pdf/attendance-report-pdf";
import { PdfDownloadButton } from "@/components/pdf-download-button";
import { toast } from 'sonner';
import { usePermission } from '@/lib/permissions/use-permission';
import { EmptyState } from '@/components/empty-state';

function getMonthRange(month: string) {
  return {
    startDate: `${month}-01`,
    endDate: `${month}-31`,
  };
}

function getAttendanceRate(summary: any) {
  const countedDays = (summary.present ?? 0) + (summary.absent ?? 0);
  if (countedDays === 0) return 0;
  return Math.round(((summary.present ?? 0) / countedDays) * 100);
}

export default function ReportsPage() {
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const canView = usePermission('hr_reports', 'view');
  const canExport = usePermission('hr_reports', 'export');

  const branchId = branchFilter !== 'all' ? branchFilter : undefined;
  const { startDate, endDate } = getMonthRange(month);

  const { data: branches } = useAuthQuery((api as any).hrBranches.list, {});

  const { data: summary, isLoading } = useAuthQuery(
    (api as any).hrReports.getMonthlySummary,
    {
      month,
      branchId,
    } as any,
  );

  const exportCsv = useAuthAction((api as any).hrReports.exportCSV);

  const handleExport = async () => {
    try {
      const csv = await exportCsv.mutateAsync({
        startDate,
        endDate,
        branchId,
      } as any);
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

  const filteredSummary = useMemo(() => summary ?? [], [summary]);

  const totals = useMemo(() => {
    return filteredSummary.reduce(
      (acc: any, s: any) => ({
        totalEmployees: acc.totalEmployees + 1,
        avgAttendance: acc.avgAttendance + getAttendanceRate(s),
        lateDays: acc.lateDays + (s.late ?? 0),
        totalWorkHours: acc.totalWorkHours + (s.totalWorkHours ?? 0),
      }),
      { totalEmployees: 0, avgAttendance: 0, lateDays: 0, totalWorkHours: 0 },
    );
  }, [filteredSummary]);

  const pdfData: AttendanceReportPDFData | null = useMemo(() => {
    if (!filteredSummary.length) return null;
    return {
      month,
      branchName: branchFilter !== "all"
        ? (branches ?? []).find((b: any) => b.id === branchFilter)?.name
        : undefined,
      generatedAt: new Date().toLocaleDateString("id-ID", {
        day: "2-digit", month: "long", year: "numeric",
      }),
      summary: {
        totalEmployees: totals.totalEmployees,
        avgAttendance: totals.totalEmployees > 0
          ? Math.round(totals.avgAttendance / totals.totalEmployees)
          : 0,
        lateDays: totals.lateDays,
        totalWorkHours: Math.round(totals.totalWorkHours * 100) / 100,
      },
      rows: filteredSummary.map((s: any) => ({
        nik: s.nik,
        employeeName: s.employeeName,
        branchName: (branches ?? []).find((b: any) => b.id === s.branchId)?.name ?? "-",
        date: month,
        clockIn: "-",
        clockOut: "-",
        status: s.absent > s.present ? "absent" : "present" as "present" | "late" | "absent",
        label: s.late > 0 ? "Terlambat" : s.absent > s.present ? "Alpha" : "Hadir",
        totalWorkHours: Math.round((s.totalWorkHours ?? 0) * 100) / 100,
      })),
    };
  }, [filteredSummary, branches, month, branchFilter, totals]);

  if (!canView) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        You don't have permission to view reports.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reports</h1>
        {canExport && (
          <div className="flex gap-2">
            <PdfDownloadButton
              doc={<AttendanceReportPDF data={pdfData!} />}
              fileName={`attendance-report-${month}.pdf`}
              label="Export PDF"
              disabled={!pdfData}
            />
            <Button size="sm" onClick={handleExport} disabled={exportCsv.isPending}>
              <Download className="mr-1 h-4 w-4" />Export CSV
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="w-44"
        />
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Users className="h-8 w-8 text-muted-foreground" />
            <div>
              <div className="text-2xl font-bold">{totals.totalEmployees}</div>
              <div className="text-xs text-muted-foreground">Employees</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <TrendingUp className="h-8 w-8 text-green-600" />
            <div>
              <div className="text-2xl font-bold">
                {totals.totalEmployees > 0
                  ? Math.round(totals.avgAttendance / totals.totalEmployees)
                  : 0}%
              </div>
              <div className="text-xs text-muted-foreground">Avg Attendance</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Clock className="h-8 w-8 text-yellow-600" />
            <div>
              <div className="text-2xl font-bold">{totals.lateDays}</div>
              <div className="text-xs text-muted-foreground">Late Days</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Employee Breakdown */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : !filteredSummary.length ? (
        <EmptyState
          icon={<FileSpreadsheet className="size-7" />}
          title="No data for this period"
          description="Select a different month or branch."
        />
      ) : (
        <div className="divide-y rounded-lg border">
          <div className="grid grid-cols-6 gap-2 bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">
            <div>Employee</div>
            <div>NIK</div>
            <div className="text-right">Attendance</div>
            <div className="text-right">Present/Late</div>
            <div className="text-right">Absent/Holiday</div>
            <div className="text-right">Hours</div>
          </div>
          {filteredSummary.map((s: any) => (
            <div
              key={s.employeeId}
              className="grid grid-cols-6 items-center gap-2 px-4 py-3 text-sm"
            >
              <div className="font-medium">{s.employeeName}</div>
              <div className="text-muted-foreground">{s.nik}</div>
              <div className="text-right font-medium">{getAttendanceRate(s)}%</div>
              <div className="text-right text-muted-foreground">
                {s.present ?? 0}/{s.late ?? 0}
              </div>
              <div className="text-right text-muted-foreground">
                {s.absent ?? 0}/{s.holiday ?? 0}
              </div>
              <div className="text-right text-muted-foreground">
                {Math.round((s.totalWorkHours ?? 0) * 100) / 100}h
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
