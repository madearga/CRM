import { zid } from 'convex-helpers/server/zod';
import { ConvexError } from 'convex/values';
import { z } from 'zod';
import { createOrgMutation, createOrgQuery } from './functions';
import { assertBranchAccess } from './hrUtils';

const shiftOutputSchema = z.object({
  id: zid('shifts'),
  name: z.string(),
  branchId: zid('branches'),
  startTime: z.string(),
  endTime: z.string(),
  lateToleranceMinutes: z.number(),
  daysOfWeek: z.array(z.number()),
  createdAt: z.number(),
  updatedAt: z.number(),
});

function toShiftOutput(shift: any) {
  return {
    id: shift._id,
    name: shift.name,
    branchId: shift.branchId,
    startTime: shift.startTime,
    endTime: shift.endTime,
    lateToleranceMinutes: shift.lateToleranceMinutes,
    daysOfWeek: shift.daysOfWeek,
    createdAt: shift.createdAt,
    updatedAt: shift.updatedAt,
  };
}

async function getOwnedShift(ctx: any, id: any) {
  const shift = await ctx.table('shifts').get(id);
  if (!shift || shift.organizationId !== ctx.orgId) {
    throw new ConvexError({ code: 'NOT_FOUND', message: 'Shift not found' });
  }
  await assertBranchAccess(ctx, shift.branchId);
  return shift;
}

async function assertBranch(ctx: any, branchId: any) {
  const branch = await ctx.table('branches').get(branchId);
  if (!branch || branch.organizationId !== ctx.orgId || !branch.isActive) {
    throw new ConvexError({ code: 'NOT_FOUND', message: 'Branch not found' });
  }
  await assertBranchAccess(ctx, branchId);
}

function assertTime(value: string, field: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new ConvexError({ code: 'BAD_REQUEST', message: `${field} must use HH:mm` });
  }
}

function assertDays(days: number[]) {
  if (days.length === 0 || days.some((day) => day < 0 || day > 6 || !Number.isInteger(day))) {
    throw new ConvexError({ code: 'BAD_REQUEST', message: 'daysOfWeek must contain numbers from 0 to 6' });
  }
}

export const list = createOrgQuery({
  permission: { feature: 'hr_shifts', action: 'view' },
})({
  args: { branchId: zid('branches').optional() },
  returns: z.array(shiftOutputSchema),
  handler: async (ctx, args) => {
    const shifts = args.branchId
      ? await ctx
          .table('shifts', 'organizationId_branchId', (q: any) =>
            q.eq('organizationId', ctx.orgId).eq('branchId', args.branchId)
          )
          .take(200)
      : await ctx
          .table('shifts', 'organizationId', (q: any) => q.eq('organizationId', ctx.orgId))
          .take(200);
    const scoped: any[] = [];
    for (const shift of shifts) {
      try {
        await assertBranchAccess(ctx, shift.branchId);
        scoped.push(shift);
      } catch {
        continue;
      }
    }
    return scoped.map(toShiftOutput);
  },
});

export const create = createOrgMutation({
  permission: { feature: 'hr_shifts', action: 'create' },
})({
  args: {
    branchId: zid('branches'),
    name: z.string().min(1),
    startTime: z.string(),
    endTime: z.string(),
    lateToleranceMinutes: z.number().min(0).max(240),
    daysOfWeek: z.array(z.number()),
  },
  returns: zid('shifts'),
  handler: async (ctx, args) => {
    await assertBranch(ctx, args.branchId);
    assertTime(args.startTime, 'startTime');
    assertTime(args.endTime, 'endTime');
    assertDays(args.daysOfWeek);
    const now = Date.now();
    return ctx.table('shifts').insert({
      branchId: args.branchId,
      name: args.name,
      startTime: args.startTime,
      endTime: args.endTime,
      lateToleranceMinutes: args.lateToleranceMinutes,
      daysOfWeek: args.daysOfWeek,
      organizationId: ctx.orgId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = createOrgMutation({
  permission: { feature: 'hr_shifts', action: 'edit' },
})({
  args: {
    id: zid('shifts'),
    name: z.string().min(1).optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    lateToleranceMinutes: z.number().min(0).max(240).optional(),
    daysOfWeek: z.array(z.number()).optional(),
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const shift = await getOwnedShift(ctx, args.id);
    if (args.startTime) assertTime(args.startTime, 'startTime');
    if (args.endTime) assertTime(args.endTime, 'endTime');
    if (args.daysOfWeek) assertDays(args.daysOfWeek);
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    for (const key of ['name', 'startTime', 'endTime', 'lateToleranceMinutes', 'daysOfWeek']) {
      if ((args as any)[key] !== undefined) patch[key] = (args as any)[key];
    }
    await shift.patch(patch);
    return null;
  },
});

export const remove = createOrgMutation({
  permission: { feature: 'hr_shifts', action: 'delete' },
})({
  args: { id: zid('shifts') },
  returns: z.null(),
  handler: async (ctx, args) => {
    const shift = await getOwnedShift(ctx, args.id);
    const assignments = await ctx
      .table('shiftAssignments', 'organizationId_startDate', (q: any) => q.eq('organizationId', ctx.orgId))
      .filter((q: any) => q.eq(q.field('shiftId'), shift._id))
      .take(1);
    if (assignments.length > 0) {
      throw new ConvexError({ code: 'CONFLICT', message: 'Shift has assignments' });
    }
    await shift.delete();
    return null;
  },
});
