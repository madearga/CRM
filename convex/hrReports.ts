import { zid } from 'convex-helpers/server/zod';
import { z } from 'zod';
import { api } from './_generated/api';
import { createOrgAction, createOrgQuery } from './functions';
import { assertBranchAccess, csvEscape } from './hrUtils';

const reportRowSchema = z.object({
  employeeId: zid('employees'),
  nik: z.string(),
  employeeName: z.string(),
  branchId: zid('branches'),
  branchName: z.string(),
  date: z.string(),
  clockIn: z.number().nullable().optional(),
  clockOut: z.number().nullable().optional(),
  status: z.string(),
  label: z.string().nullable().optional(),
  totalWorkHours: z.number().nullable().optional(),
  lateMinutes: z.number().nullable().optional(),
});

async function buildReportRows(ctx: any, args: { branchId?: any; employeeId?: any; startDate: string; endDate: string; status?: string }) {
  if (args.branchId) await assertBranchAccess(ctx, args.branchId);
  const records = await ctx
    .table('attendanceRecords', 'organizationId_date', (q: any) => q.eq('organizationId', ctx.orgId))
    .take(2000);
  const rows: any[] = [];
  for (const record of records) {
    if (record.date < args.startDate || record.date > args.endDate) continue;
    if (args.branchId && record.branchId !== args.branchId) continue;
    if (args.employeeId && record.employeeId !== args.employeeId) continue;
    if (args.status && record.status !== args.status) continue;
    await assertBranchAccess(ctx, record.branchId);
    const employee = await ctx.table('employees').get(record.employeeId);
    const branch = await ctx.table('branches').get(record.branchId);
    if (!employee || !branch) continue;
    rows.push({
      employeeId: employee._id,
      nik: employee.nik,
      employeeName: employee.name,
      branchId: branch._id,
      branchName: branch.name,
      date: record.date,
      clockIn: record.clockIn,
      clockOut: record.clockOut,
      status: record.status,
      label: record.label,
      totalWorkHours: record.totalWorkHours,
      lateMinutes: record.lateMinutes,
    });
  }
  return rows.sort((a, b) => `${a.date}${a.employeeName}`.localeCompare(`${b.date}${b.employeeName}`));
}

export const getAttendanceReport = createOrgQuery({
  permission: { feature: 'hr_reports', action: 'view' },
})({
  args: {
    branchId: zid('branches').optional(),
    employeeId: zid('employees').optional(),
    startDate: z.string(),
    endDate: z.string(),
    status: z.string().optional(),
  },
  returns: z.array(reportRowSchema),
  handler: async (ctx, args) => buildReportRows(ctx, args),
});

export const getMonthlySummary = createOrgQuery({
  permission: { feature: 'hr_reports', action: 'view' },
})({
  args: {
    branchId: zid('branches').optional(),
    month: z.string(),
  },
  returns: z.array(
    z.object({
      employeeId: zid('employees'),
      nik: z.string(),
      employeeName: z.string(),
      branchId: zid('branches'),
      present: z.number(),
      late: z.number(),
      absent: z.number(),
      holiday: z.number(),
      totalWorkHours: z.number(),
    })
  ),
  handler: async (ctx, args) => {
    const startDate = `${args.month}-01`;
    const endDate = `${args.month}-31`;
    const rows = await buildReportRows(ctx, { branchId: args.branchId, startDate, endDate });
    const holidays = await ctx
      .table('holidays', 'organizationId', (q: any) => q.eq('organizationId', ctx.orgId))
      .take(400);
    const holidayDates = new Set(holidays.map((holiday: any) => holiday.date));
    const byEmployee = new Map<string, any>();
    for (const row of rows) {
      const key = String(row.employeeId);
      const summary = byEmployee.get(key) ?? {
        employeeId: row.employeeId,
        nik: row.nik,
        employeeName: row.employeeName,
        branchId: row.branchId,
        present: 0,
        late: 0,
        absent: 0,
        holiday: 0,
        totalWorkHours: 0,
      };
      if (holidayDates.has(row.date) || row.status === 'holiday') summary.holiday += 1;
      else if (row.status === 'present') summary.present += 1;
      else if (row.status === 'absent') summary.absent += 1;
      if (row.label === 'late') summary.late += 1;
      summary.totalWorkHours += row.totalWorkHours ?? 0;
      byEmployee.set(key, summary);
    }
    return Array.from(byEmployee.values());
  },
});

export const exportCSV = createOrgAction({
  permission: { feature: 'hr_reports', action: 'export' },
})({
  args: {
    branchId: zid('branches').optional(),
    employeeId: zid('employees').optional(),
    startDate: z.string(),
    endDate: z.string(),
    status: z.string().optional(),
  },
  returns: z.string(),
  handler: async (ctx, args) => {
    const rows = await ctx.runQuery(api.hrReports.getAttendanceReport, args as any);
    const header = ['NIK', 'Nama', 'Branch', 'Tanggal', 'Jam Masuk', 'Jam Keluar', 'Status', 'Label', 'Durasi (jam)', 'Keterlambatan (menit)'];
    const lines = [header.map(csvEscape).join(',')];
    for (const row of rows as any[]) {
      lines.push([
        row.nik,
        row.employeeName,
        row.branchName,
        row.date,
        row.clockIn ? new Date(row.clockIn).toISOString() : '',
        row.clockOut ? new Date(row.clockOut).toISOString() : '',
        row.status,
        row.label ?? '',
        row.totalWorkHours ?? '',
        row.lateMinutes ?? '',
      ].map(csvEscape).join(','));
    }
    return lines.join('\n');
  },
});
