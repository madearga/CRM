import { zid } from 'convex-helpers/server/zod';
import { ConvexError } from 'convex/values';
import { z } from 'zod';
import { createInternalMutation, createOrgQuery, createPublicMutation } from './functions';
import { locationSchema } from './hrTypes';
import { assertBranchAccess, calculateAttendanceTiming, calculateWorkHours, getDateKey, getMondayBasedDay, timeToMinutes } from './hrUtils';

const attendanceOutputSchema = z.object({
  id: zid('attendanceRecords'),
  employeeId: zid('employees'),
  branchId: zid('branches'),
  date: z.string(),
  clockIn: z.number().nullable().optional(),
  clockOut: z.number().nullable().optional(),
  status: z.string(),
  label: z.string().nullable().optional(),
  lateMinutes: z.number().nullable().optional(),
  earlyLeaveMinutes: z.number().nullable().optional(),
  totalWorkHours: z.number().nullable().optional(),
});

function toAttendanceOutput(record: any) {
  return {
    id: record._id,
    employeeId: record.employeeId,
    branchId: record.branchId,
    date: record.date,
    clockIn: record.clockIn,
    clockOut: record.clockOut,
    status: record.status,
    label: record.label,
    lateMinutes: record.lateMinutes,
    earlyLeaveMinutes: record.earlyLeaveMinutes,
    totalWorkHours: record.totalWorkHours,
  };
}

async function findEmployeeByWhatsApp(ctx: any, whatsappNumber: string) {
  const employees = await ctx
    .table('employees', 'organizationId_whatsappNumber', (q: any) =>
      q.eq('organizationId', ctx.orgId).eq('whatsappNumber', whatsappNumber)
    )
    .take(1);
  const employee = employees[0];
  if (!employee || employee.status !== 'active') {
    throw new ConvexError({ code: 'NOT_FOUND', message: 'Active employee not found for WhatsApp number' });
  }
  return employee;
}

async function findShiftForEmployee(ctx: any, employee: any, timestamp: number) {
  const day = getMondayBasedDay(timestamp);
  const date = getDateKey(timestamp);
  const assignments = await ctx
    .table('shiftAssignments', 'employeeId_startDate', (q: any) => q.eq('employeeId', employee._id))
    .take(200);
  for (const assignment of assignments) {
    if (assignment.branchId !== employee.branchId) continue;
    if (assignment.startDate > timestamp) continue;
    if (assignment.endDate && assignment.endDate < timestamp) continue;
    const active = assignment.recurrenceType === 'once'
      ? assignment.specificDate && getDateKey(assignment.specificDate) === date
      : assignment.daysOfWeek?.includes(day);
    if (!active) continue;
    const shift = await ctx.table('shifts').get(assignment.shiftId);
    if (shift) return { assignment, shift };
  }
  return { assignment: null, shift: null };
}

export const clockInFromWhatsApp = createPublicMutation()({
  args: {
    whatsappNumber: z.string().min(6),
    qrCode: z.string().min(1),
    location: locationSchema.optional(),
  },
  returns: zid('attendanceRecords'),
  handler: async (ctx, args) => {
    const branches = await ctx.table('branches', 'qrCode', (q: any) => q.eq('qrCode', args.qrCode)).take(1);
    const branch = branches[0];
    if (!branch || !branch.isActive) {
      throw new ConvexError({ code: 'BAD_REQUEST', message: 'Invalid QR code' });
    }
    const employeeRows = await ctx
      .table('employees', 'organizationId_whatsappNumber', (q: any) =>
        q.eq('organizationId', branch.organizationId).eq('whatsappNumber', args.whatsappNumber)
      )
      .take(1);
    const employee = employeeRows[0];
    if (!employee || employee.status !== 'active' || employee.branchId !== branch._id) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Employee is not assigned to this branch' });
    }

    const now = Date.now();
    const date = getDateKey(now);
    const duplicate = await ctx
      .table('attendanceRecords', 'employeeId_date', (q: any) => q.eq('employeeId', employee._id).eq('date', date))
      .take(1);
    if (duplicate.length > 0) {
      throw new ConvexError({ code: 'CONFLICT', message: 'Already clocked in today' });
    }
    const holidays = await ctx
      .table('holidays', 'organizationId_date', (q: any) => q.eq('organizationId', branch.organizationId).eq('date', date))
      .take(1);
    if (holidays.length > 0) {
      throw new ConvexError({ code: 'BAD_REQUEST', message: `Today is a holiday: ${holidays[0].name}` });
    }

    const { assignment, shift } = await findShiftForEmployee({ ...ctx, orgId: branch.organizationId }, employee, now);
    const timing = shift
      ? calculateAttendanceTiming({ timestamp: now, startTime: shift.startTime, endTime: shift.endTime, lateToleranceMinutes: shift.lateToleranceMinutes })
      : null;

    return ctx.table('attendanceRecords').insert({
      employeeId: employee._id,
      branchId: branch._id,
      shiftAssignmentId: assignment?._id ?? null,
      date,
      clockIn: now,
      clockOut: null,
      clockInSource: 'whatsapp',
      clockInQrCode: args.qrCode,
      clockInLocation: args.location ?? null,
      clockOutLocation: null,
      status: 'present',
      label: !shift ? 'no_shift' : timing?.isLate ? 'late' : 'on_time',
      lateMinutes: timing?.lateMinutes ?? null,
      earlyLeaveMinutes: null,
      totalWorkHours: null,
      organizationId: branch.organizationId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const clockOutFromWhatsApp = createPublicMutation()({
  args: {
    organizationId: zid('organization'),
    whatsappNumber: z.string().min(6),
    location: locationSchema.optional(),
  },
  returns: attendanceOutputSchema,
  handler: async (ctx, args) => {
    const employee = await findEmployeeByWhatsApp({ ...ctx, orgId: args.organizationId }, args.whatsappNumber);
    const now = Date.now();
    const date = getDateKey(now);
    const records = await ctx
      .table('attendanceRecords', 'employeeId_date', (q: any) => q.eq('employeeId', employee._id).eq('date', date))
      .take(1);
    const record = records[0];
    if (!record || !record.clockIn) {
      throw new ConvexError({ code: 'BAD_REQUEST', message: 'No clock-in found for today' });
    }
    if (record.clockOut) return toAttendanceOutput(record);

    let earlyLeaveMinutes: number | null = null;
    let label = record.label;
    if (record.shiftAssignmentId) {
      const assignment = await ctx.table('shiftAssignments').get(record.shiftAssignmentId);
      const shift = assignment ? await ctx.table('shifts').get(assignment.shiftId) : null;
      if (shift) {
        const endMinutes = timeToMinutes(shift.endTime);
        const nowMinutes = new Date(now).getHours() * 60 + new Date(now).getMinutes();
        if (nowMinutes < endMinutes) {
          earlyLeaveMinutes = endMinutes - nowMinutes;
          label = 'early_leave';
        }
      }
    }

    const writer = await ctx.table('attendanceRecords').get(record._id);
    await writer!.patch({
      clockOut: now,
      clockOutLocation: args.location ?? null,
      label,
      earlyLeaveMinutes,
      totalWorkHours: calculateWorkHours(record.clockIn, now),
      updatedAt: now,
    });
    const updated = await ctx.table('attendanceRecords').get(record._id);
    return toAttendanceOutput(updated!);
  },
});

export const getDailySummary = createOrgQuery({
  permission: { feature: 'hr_attendance', action: 'view' },
})({
  args: { date: z.string(), branchId: zid('branches').optional() },
  returns: z.array(z.object({ branchId: zid('branches'), total: z.number(), present: z.number(), late: z.number(), absent: z.number() })),
  handler: async (ctx, args) => {
    if (args.branchId) await assertBranchAccess(ctx, args.branchId);
    const employees = await ctx
      .table('employees', 'organizationId_status', (q: any) => q.eq('organizationId', ctx.orgId).eq('status', 'active'))
      .take(500);
    const records = await ctx
      .table('attendanceRecords', 'organizationId_date', (q: any) => q.eq('organizationId', ctx.orgId).eq('date', args.date))
      .take(500);
    const byBranch = new Map<string, { branchId: any; total: number; present: number; late: number; absent: number }>();
    for (const employee of employees) {
      if (args.branchId && employee.branchId !== args.branchId) continue;
      await assertBranchAccess(ctx, employee.branchId);
      const key = String(employee.branchId);
      const row = byBranch.get(key) ?? { branchId: employee.branchId, total: 0, present: 0, late: 0, absent: 0 };
      row.total += 1;
      const record = records.find((r: any) => r.employeeId === employee._id);
      if (record) {
        row.present += 1;
        if (record.label === 'late') row.late += 1;
      } else {
        row.absent += 1;
      }
      byBranch.set(key, row);
    }
    return Array.from(byBranch.values());
  },
});

export const getByEmployee = createOrgQuery({
  permission: { feature: 'hr_attendance', action: 'view' },
})({
  args: { employeeId: zid('employees'), limit: z.number().min(1).max(200).optional() },
  returns: z.array(attendanceOutputSchema),
  handler: async (ctx, args) => {
    const employee = await ctx.table('employees').get(args.employeeId);
    if (!employee || employee.organizationId !== ctx.orgId) return [];
    await assertBranchAccess(ctx, employee.branchId);
    const rows = await ctx
      .table('attendanceRecords', 'employeeId_date', (q: any) => q.eq('employeeId', args.employeeId))
      .take(args.limit ?? 60);
    return rows.map(toAttendanceOutput);
  },
});

export const autoCloseOpenRecords = createInternalMutation()({
  args: {},
  handler: async (ctx) => {
    const today = getDateKey(Date.now());
    const rows = await ctx.table('attendanceRecords').take(1000);
    let closed = 0;
    for (const record of rows) {
      if (!record.clockIn || record.clockOut || record.date >= today) continue;
      let clockOut = record.clockIn;
      if (record.shiftAssignmentId) {
        const assignment = await ctx.table('shiftAssignments').get(record.shiftAssignmentId);
        const shift = assignment ? await ctx.table('shifts').get(assignment.shiftId) : null;
        if (shift) {
          const [hours, minutes] = shift.endTime.split(':').map(Number);
          const date = new Date(record.clockIn);
          date.setHours(hours, minutes, 0, 0);
          clockOut = date.getTime();
        }
      }
      const writer = await ctx.table('attendanceRecords').get(record._id);
      await writer!.patch({
        clockOut,
        label: 'forgot_clockout',
        totalWorkHours: calculateWorkHours(record.clockIn, clockOut),
        updatedAt: Date.now(),
      });
      closed += 1;
    }
    return { closed };
  },
});
