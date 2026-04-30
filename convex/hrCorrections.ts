import { zid } from 'convex-helpers/server/zod';
import { ConvexError } from 'convex/values';
import { z } from 'zod';
import { createOrgMutation, createOrgQuery, createPublicMutation } from './functions';
import { correctionStatusSchema } from './hrTypes';
import { assertBranchAccess, calculateWorkHours } from './hrUtils';

const correctionOutputSchema = z.object({
  id: zid('attendanceCorrections'),
  attendanceRecordId: zid('attendanceRecords'),
  status: correctionStatusSchema,
  correctedClockIn: z.number().nullable().optional(),
  correctedClockOut: z.number().nullable().optional(),
  reason: z.string(),
  reviewNote: z.string().nullable().optional(),
  createdAt: z.number(),
  reviewedAt: z.number().nullable().optional(),
});

function toCorrectionOutput(row: any) {
  return {
    id: row._id,
    attendanceRecordId: row.attendanceRecordId,
    status: row.status,
    correctedClockIn: row.correctedClockIn,
    correctedClockOut: row.correctedClockOut,
    reason: row.reason,
    reviewNote: row.reviewNote,
    createdAt: row.createdAt,
    reviewedAt: row.reviewedAt,
  };
}

async function getOwnedRecord(ctx: any, attendanceRecordId: any) {
  const record = await ctx.table('attendanceRecords').get(attendanceRecordId);
  if (!record || record.organizationId !== ctx.orgId) {
    throw new ConvexError({ code: 'NOT_FOUND', message: 'Attendance record not found' });
  }
  await assertBranchAccess(ctx, record.branchId);
  return record;
}

export const request = createPublicMutation()({
  args: {
    organizationId: zid('organization'),
    whatsappNumber: z.string().min(6),
    attendanceRecordId: zid('attendanceRecords'),
    correctedClockIn: z.number().nullable().optional(),
    correctedClockOut: z.number().nullable().optional(),
    reason: z.string().min(3),
  },
  returns: zid('attendanceCorrections'),
  handler: async (ctx, args) => {
    const employees = await ctx
      .table('employees', 'organizationId_whatsappNumber', (q: any) =>
        q.eq('organizationId', args.organizationId).eq('whatsappNumber', args.whatsappNumber)
      )
      .take(1);
    const employee = employees[0];
    if (!employee) throw new ConvexError({ code: 'NOT_FOUND', message: 'Employee not found' });
    const record = await ctx.table('attendanceRecords').get(args.attendanceRecordId);
    if (!record || record.employeeId !== employee._id) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Attendance record not found for employee' });
    }
    return ctx.table('attendanceCorrections').insert({
      attendanceRecordId: args.attendanceRecordId,
      requestedByEmployeeId: employee._id,
      requestedByUserId: null,
      correctedClockIn: args.correctedClockIn ?? null,
      correctedClockOut: args.correctedClockOut ?? null,
      reason: args.reason,
      status: 'pending',
      reviewNote: null,
      reviewedBy: null,
      reviewedAt: null,
      organizationId: args.organizationId,
      createdAt: Date.now(),
    });
  },
});

export const listPending = createOrgQuery({
  permission: { feature: 'hr_attendance', action: 'manage' },
})({
  args: { branchId: zid('branches').optional() },
  returns: z.array(correctionOutputSchema),
  handler: async (ctx, args) => {
    if (args.branchId) await assertBranchAccess(ctx, args.branchId);
    const rows = await ctx
      .table('attendanceCorrections', 'organizationId_status', (q: any) =>
        q.eq('organizationId', ctx.orgId).eq('status', 'pending')
      )
      .take(200);
    const scoped: any[] = [];
    for (const row of rows) {
      const record = await ctx.table('attendanceRecords').get(row.attendanceRecordId);
      if (!record) continue;
      if (args.branchId && record.branchId !== args.branchId) continue;
      await assertBranchAccess(ctx, record.branchId);
      scoped.push(row);
    }
    return scoped.map(toCorrectionOutput);
  },
});

export const review = createOrgMutation({
  permission: { feature: 'hr_attendance', action: 'manage' },
})({
  args: {
    id: zid('attendanceCorrections'),
    status: z.enum(['approved', 'rejected']),
    reviewNote: z.string().nullable().optional(),
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const correction = await ctx.table('attendanceCorrections').get(args.id);
    if (!correction || correction.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Correction not found' });
    }
    if (correction.status !== 'pending') {
      throw new ConvexError({ code: 'CONFLICT', message: 'Correction already reviewed' });
    }
    const record = await getOwnedRecord(ctx, correction.attendanceRecordId);
    if (args.status === 'approved') {
      const clockIn = correction.correctedClockIn ?? record.clockIn;
      const clockOut = correction.correctedClockOut ?? record.clockOut;
      await record.patch({
        clockIn,
        clockOut,
        totalWorkHours: clockIn && clockOut ? calculateWorkHours(clockIn, clockOut) : record.totalWorkHours,
        updatedAt: Date.now(),
      });
    }
    await correction.patch({
      status: args.status,
      reviewNote: args.reviewNote ?? null,
      reviewedBy: ctx.userId,
      reviewedAt: Date.now(),
    });
    return null;
  },
});
