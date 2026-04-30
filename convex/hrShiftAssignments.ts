import { zid } from 'convex-helpers/server/zod';
import { ConvexError } from 'convex/values';
import { z } from 'zod';
import { createOrgMutation, createOrgQuery } from './functions';
import { shiftRecurrenceSchema } from './hrTypes';
import { assertBranchAccess, getDateKey, getMondayBasedDay } from './hrUtils';

const assignmentOutputSchema = z.object({
  id: zid('shiftAssignments'),
  employeeId: zid('employees'),
  shiftId: zid('shifts'),
  branchId: zid('branches'),
  recurrenceType: shiftRecurrenceSchema,
  daysOfWeek: z.array(z.number()).optional(),
  startDate: z.number(),
  endDate: z.number().nullable().optional(),
  specificDate: z.number().nullable().optional(),
  createdAt: z.number(),
});

function toAssignmentOutput(assignment: any) {
  return {
    id: assignment._id,
    employeeId: assignment.employeeId,
    shiftId: assignment.shiftId,
    branchId: assignment.branchId,
    recurrenceType: assignment.recurrenceType,
    daysOfWeek: assignment.daysOfWeek,
    startDate: assignment.startDate,
    endDate: assignment.endDate,
    specificDate: assignment.specificDate,
    createdAt: assignment.createdAt,
  };
}

async function getEmployeeAndShift(ctx: any, employeeId: any, shiftId: any) {
  const employee = await ctx.table('employees').get(employeeId);
  if (!employee || employee.organizationId !== ctx.orgId || employee.status !== 'active') {
    throw new ConvexError({ code: 'NOT_FOUND', message: 'Active employee not found' });
  }
  const shift = await ctx.table('shifts').get(shiftId);
  if (!shift || shift.organizationId !== ctx.orgId) {
    throw new ConvexError({ code: 'NOT_FOUND', message: 'Shift not found' });
  }
  if (employee.branchId !== shift.branchId) {
    throw new ConvexError({ code: 'BAD_REQUEST', message: 'Employee and shift must use the same branch' });
  }
  await assertBranchAccess(ctx, shift.branchId);
  return { employee, shift };
}

function rangesOverlap(aStart: number, aEnd: number | null | undefined, bStart: number, bEnd: number | null | undefined) {
  const ae = aEnd ?? Number.MAX_SAFE_INTEGER;
  const be = bEnd ?? Number.MAX_SAFE_INTEGER;
  return aStart <= be && bStart <= ae;
}

async function assertNoAssignmentConflict(ctx: any, employeeId: any, startDate: number, endDate: number | null | undefined) {
  const existing = await ctx
    .table('shiftAssignments', 'employeeId_startDate', (q: any) => q.eq('employeeId', employeeId))
    .take(200);
  const conflict = existing.find((assignment: any) => rangesOverlap(assignment.startDate, assignment.endDate, startDate, endDate));
  if (conflict) {
    throw new ConvexError({ code: 'CONFLICT', message: 'Employee already has an overlapping assignment' });
  }
}

export const assign = createOrgMutation({
  permission: { feature: 'hr_shifts', action: 'edit' },
})({
  args: {
    employeeId: zid('employees'),
    shiftId: zid('shifts'),
    recurrenceType: shiftRecurrenceSchema,
    startDate: z.number(),
    endDate: z.number().nullable().optional(),
    specificDate: z.number().nullable().optional(),
    daysOfWeek: z.array(z.number()).optional(),
  },
  returns: zid('shiftAssignments'),
  handler: async (ctx, args) => {
    const { shift } = await getEmployeeAndShift(ctx, args.employeeId, args.shiftId);
    if (args.recurrenceType === 'once' && !args.specificDate) {
      throw new ConvexError({ code: 'BAD_REQUEST', message: 'specificDate is required for once assignments' });
    }
    if (args.recurrenceType === 'weekly' && (!args.daysOfWeek || args.daysOfWeek.length === 0)) {
      throw new ConvexError({ code: 'BAD_REQUEST', message: 'daysOfWeek is required for weekly assignments' });
    }
    await assertNoAssignmentConflict(ctx, args.employeeId, args.startDate, args.endDate);
    return ctx.table('shiftAssignments').insert({
      employeeId: args.employeeId,
      shiftId: args.shiftId,
      branchId: shift.branchId,
      recurrenceType: args.recurrenceType,
      daysOfWeek: args.daysOfWeek,
      startDate: args.startDate,
      endDate: args.endDate ?? null,
      specificDate: args.specificDate ?? null,
      organizationId: ctx.orgId,
      createdAt: Date.now(),
    });
  },
});

export const remove = createOrgMutation({
  permission: { feature: 'hr_shifts', action: 'delete' },
})({
  args: { id: zid('shiftAssignments') },
  returns: z.null(),
  handler: async (ctx, args) => {
    const assignment = await ctx.table('shiftAssignments').get(args.id);
    if (!assignment || assignment.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Assignment not found' });
    }
    await assertBranchAccess(ctx, assignment.branchId);
    const attendance = await ctx
      .table('attendanceRecords', 'employeeId_date', (q: any) => q.eq('employeeId', assignment.employeeId))
      .filter((q: any) => q.eq(q.field('shiftAssignmentId'), assignment._id))
      .take(1);
    if (attendance.length > 0) {
      throw new ConvexError({ code: 'CONFLICT', message: 'Cannot delete assignment with attendance records' });
    }
    await assignment.delete();
    return null;
  },
});

export const getByEmployee = createOrgQuery({
  permission: { feature: 'hr_shifts', action: 'view' },
})({
  args: { employeeId: zid('employees') },
  returns: z.array(assignmentOutputSchema),
  handler: async (ctx, args) => {
    const employee = await ctx.table('employees').get(args.employeeId);
    if (!employee || employee.organizationId !== ctx.orgId) return [];
    await assertBranchAccess(ctx, employee.branchId);
    const assignments = await ctx
      .table('shiftAssignments', 'employeeId_startDate', (q: any) => q.eq('employeeId', args.employeeId))
      .take(200);
    return assignments.map(toAssignmentOutput);
  },
});

export const getSchedule = createOrgQuery({
  permission: { feature: 'hr_shifts', action: 'view' },
})({
  args: {
    branchId: zid('branches').optional(),
    startDate: z.number(),
    endDate: z.number(),
  },
  returns: z.array(
    assignmentOutputSchema.extend({
      date: z.string(),
      shiftName: z.string(),
      employeeName: z.string(),
      startTime: z.string(),
      endTime: z.string(),
    })
  ),
  handler: async (ctx, args) => {
    if (args.branchId) await assertBranchAccess(ctx, args.branchId);
    const assignments = await ctx
      .table('shiftAssignments', 'organizationId_startDate', (q: any) => q.eq('organizationId', ctx.orgId))
      .take(500);
    const rows: any[] = [];
    for (const assignment of assignments) {
      if (args.branchId && assignment.branchId !== args.branchId) continue;
      if (!rangesOverlap(assignment.startDate, assignment.endDate, args.startDate, args.endDate)) continue;
      await assertBranchAccess(ctx, assignment.branchId);
      const shift = await ctx.table('shifts').get(assignment.shiftId);
      const employee = await ctx.table('employees').get(assignment.employeeId);
      if (!shift || !employee) continue;
      for (let ts = args.startDate; ts <= args.endDate; ts += 86_400_000) {
        const date = getDateKey(ts);
        const day = getMondayBasedDay(ts);
        const active = assignment.recurrenceType === 'once'
          ? assignment.specificDate && getDateKey(assignment.specificDate) === date
          : assignment.daysOfWeek?.includes(day);
        if (!active) continue;
        rows.push({
          ...toAssignmentOutput(assignment),
          date,
          shiftName: shift.name,
          employeeName: employee.name,
          startTime: shift.startTime,
          endTime: shift.endTime,
        });
      }
    }
    return rows.sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
  },
});
