import { zid } from 'convex-helpers/server/zod';
import { ConvexError } from 'convex/values';
import { z } from 'zod';
import { createOrgMutation, createOrgQuery } from './functions';

const holidayOutputSchema = z.object({
  id: zid('holidays'),
  date: z.string(),
  name: z.string(),
  isRecurring: z.boolean(),
  createdAt: z.number(),
});

function toHolidayOutput(row: any) {
  return { id: row._id, date: row.date, name: row.name, isRecurring: row.isRecurring, createdAt: row.createdAt };
}

function assertDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ConvexError({ code: 'BAD_REQUEST', message: 'Date must use YYYY-MM-DD' });
  }
}

export const list = createOrgQuery({
  permission: { feature: 'hr_holidays', action: 'view' },
})({
  args: {},
  returns: z.array(holidayOutputSchema),
  handler: async (ctx) => {
    const rows = await ctx
      .table('holidays', 'organizationId', (q: any) => q.eq('organizationId', ctx.orgId))
      .take(300);
    return rows.map(toHolidayOutput).sort((a, b) => a.date.localeCompare(b.date));
  },
});

export const create = createOrgMutation({
  permission: { feature: 'hr_holidays', action: 'create' },
})({
  args: { date: z.string(), name: z.string().min(1), isRecurring: z.boolean().optional() },
  returns: zid('holidays'),
  handler: async (ctx, args) => {
    assertDate(args.date);
    const existing = await ctx
      .table('holidays', 'organizationId_date', (q: any) => q.eq('organizationId', ctx.orgId).eq('date', args.date))
      .take(1);
    if (existing.length > 0) {
      throw new ConvexError({ code: 'CONFLICT', message: 'Holiday already exists for this date' });
    }
    return ctx.table('holidays').insert({
      date: args.date,
      name: args.name,
      isRecurring: args.isRecurring ?? false,
      organizationId: ctx.orgId,
      createdAt: Date.now(),
    });
  },
});

export const importBulk = createOrgMutation({
  permission: { feature: 'hr_holidays', action: 'create' },
})({
  args: { holidays: z.array(z.object({ date: z.string(), name: z.string().min(1), isRecurring: z.boolean().optional() })) },
  returns: z.object({ created: z.number(), skipped: z.number() }),
  handler: async (ctx, args) => {
    let created = 0;
    let skipped = 0;
    for (const holiday of args.holidays) {
      assertDate(holiday.date);
      const existing = await ctx
        .table('holidays', 'organizationId_date', (q: any) => q.eq('organizationId', ctx.orgId).eq('date', holiday.date))
        .take(1);
      if (existing.length > 0) {
        skipped += 1;
        continue;
      }
      await ctx.table('holidays').insert({
        date: holiday.date,
        name: holiday.name,
        isRecurring: holiday.isRecurring ?? false,
        organizationId: ctx.orgId,
        createdAt: Date.now(),
      });
      created += 1;
    }
    return { created, skipped };
  },
});

export const remove = createOrgMutation({
  permission: { feature: 'hr_holidays', action: 'delete' },
})({
  args: { id: zid('holidays') },
  returns: z.null(),
  handler: async (ctx, args) => {
    const holiday = await ctx.table('holidays').get(args.id);
    if (!holiday || holiday.organizationId !== ctx.orgId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Holiday not found' });
    }
    await holiday.delete();
    return null;
  },
});
