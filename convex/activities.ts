import { zid } from 'convex-helpers/server/zod';
import { ConvexError } from 'convex/values';
import { z } from 'zod';

import { createOrgMutation, createOrgQuery } from './functions';

const activityTypeSchema = z.enum([
  'call',
  'email',
  'meeting',
  'note',
  'status_change',
]);

const activityStatusSchema = z.enum(['planned', 'done', 'cancelled']);
const prioritySchema = z.enum(['low', 'medium', 'high']);

const entityTypeSchema = z.enum([
  'company',
  'contact',
  'deal',
  'product',
  'saleOrder',
  'invoice',
  'purchaseOrder',
  'ticket',
  'expense',
  'employee',
  'task',
]);

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

// List activities for a specific entity, ordered by creation time desc.
export const activitiesForEntity = createOrgQuery()({
  args: {
    entityType: entityTypeSchema,
    entityId: z.string(),
  },
  handler: async (ctx, args) => {
    const { orgId } = ctx;

    return await ctx
      .table('activities', 'organizationId_entityType_entityId', (q) =>
        q.eq('organizationId', orgId).eq('entityType', args.entityType).eq('entityId', args.entityId)
      )
      .order('desc');
  },
});

// Backward-compatible alias.
export const listByEntity = activitiesForEntity;

// Timeline: all activities for entity (planned + done), ordered by scheduledAt/createdAt
export const timeline = createOrgQuery()({
  args: {
    entityType: entityTypeSchema,
    entityId: z.string(),
  },
  handler: async (ctx, args) => {
    const { orgId } = ctx;

    const activities = await ctx
      .table('activities', 'organizationId_entityType_entityId', (q) =>
        q.eq('organizationId', orgId).eq('entityType', args.entityType).eq('entityId', args.entityId)
      );

    // Sort: planned (by scheduledAt asc) then done/cancelled (by completedAt/createdAt desc)
    return activities.sort((a: any, b: any) => {
      const aPlanned = a.status === 'planned' || (!a.status && !a.completedAt);
      const bPlanned = b.status === 'planned' || (!b.status && !b.completedAt);

      if (aPlanned && !bPlanned) return -1;
      if (!aPlanned && bPlanned) return 1;

      if (aPlanned && bPlanned) {
        return (a.scheduledAt ?? a.dueAt ?? a._creationTime) - (b.scheduledAt ?? b.dueAt ?? b._creationTime);
      }

      return (b.completedAt ?? b._creationTime) - (a.completedAt ?? a._creationTime);
    });
  },
});

// List recent activities for the current org (dashboard).
export const listRecent = createOrgQuery()({
  args: {},
  handler: async (ctx) => {
    const { orgId } = ctx;

    return await ctx
      .table('activities', 'organizationId_createdAt', (q) =>
        q.eq('organizationId', orgId)
      )
      .order('desc')
      .take(20);
  },
});

// List upcoming activities (planned, scheduledAt in future) for current user.
export const listUpcoming = createOrgQuery()({
  args: {},
  handler: async (ctx) => {
    const { orgId } = ctx;

    const now = Date.now();

    return await ctx
      .table('activities', 'assigneeId_dueAt', (q) =>
        q.eq('assigneeId', ctx.user._id).gt('dueAt', now)
      )
      .filter((q) => q.eq(q.field('completedAt'), undefined));
  },
});

// Upcoming: planned activities for current user, ordered by scheduledAt
export const upcoming = createOrgQuery()({
  args: {
    from: z.number().optional(),
    to: z.number().optional(),
  },
  handler: async (ctx, args) => {
    const { orgId } = ctx;
    const now = Date.now();

    const activities = await ctx
      .table('activities', 'organizationId_status_scheduledAt', (q) =>
        q.eq('organizationId', orgId).eq('status', 'planned')
      );

    const filtered = activities.filter((a: any) => {
      if (a.assigneeId && a.assigneeId !== ctx.user._id) return false;
      if (args.from && (a.scheduledAt ?? a.dueAt ?? 0) < args.from) return false;
      if (args.to && (a.scheduledAt ?? a.dueAt ?? Infinity) > args.to) return false;
      return true;
    });

    return filtered.sort((a: any, b: any) =>
      (a.scheduledAt ?? a.dueAt ?? 0) - (b.scheduledAt ?? b.dueAt ?? 0)
    );
  },
});

// Overdue: planned activities where scheduledAt < now
export const overdue = createOrgQuery()({
  args: {},
  handler: async (ctx) => {
    const { orgId } = ctx;
    const now = Date.now();

    const planned = await ctx
      .table('activities', 'organizationId_status_scheduledAt', (q) =>
        q.eq('organizationId', orgId).eq('status', 'planned')
      );

    return planned
      .filter((a: any) => {
        const due = a.scheduledAt ?? a.dueAt;
        return due != null && due < now;
      })
      .sort((a: any, b: any) =>
        (a.scheduledAt ?? a.dueAt ?? 0) - (b.scheduledAt ?? b.dueAt ?? 0)
      );
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

// Create a new activity (backward compatible).
export const create = createOrgMutation()({
  args: {
    title: z.string().min(1),
    description: z.string().optional(),
    dueAt: z.number().optional(),
    type: activityTypeSchema,
    entityType: entityTypeSchema,
    entityId: z.string(),
    assigneeId: zid('user').optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  },
  handler: async (ctx, args) => {
    const { orgId } = ctx;

    return await ctx.table('activities').insert({
      title: args.title,
      description: args.description,
      dueAt: args.dueAt,
      type: args.type,
      entityType: args.entityType,
      entityId: args.entityId,
      organizationId: orgId,
      assigneeId: args.assigneeId,
      createdBy: ctx.user._id,
      metadata: args.metadata,
    });
  },
});

// Schedule a planned activity with optional priority.
export const schedule = createOrgMutation()({
  args: {
    title: z.string().min(1),
    description: z.string().optional(),
    type: activityTypeSchema,
    entityType: entityTypeSchema,
    entityId: z.string(),
    scheduledAt: z.number(),
    priority: prioritySchema.optional(),
    assigneeId: zid('user').optional(),
    nextActivityType: z.string().optional(),
  },
  handler: async (ctx, args) => {
    const { orgId } = ctx;

    return await ctx.table('activities').insert({
      title: args.title,
      description: args.description,
      type: args.type,
      entityType: args.entityType,
      entityId: args.entityId,
      scheduledAt: args.scheduledAt,
      dueAt: args.scheduledAt,
      status: 'planned',
      priority: args.priority,
      assigneeId: args.assigneeId,
      nextActivityType: args.nextActivityType,
      organizationId: orgId,
      createdBy: ctx.user._id,
    });
  },
});

// Complete activity, optionally auto-create next planned activity.
export const complete = createOrgMutation()({
  args: {
    id: zid('activities'),
    scheduleNext: z.object({
      type: activityTypeSchema.optional(),
      delayInDays: z.number().optional(),
    }).optional(),
  },
  handler: async (ctx, args) => {
    const { orgId } = ctx;

    const activity = await ctx.table('activities').getX(args.id);

    if (activity.organizationId !== orgId) {
      throw new ConvexError({
        code: 'UNAUTHORIZED',
        message: 'No active organization',
      });
    }

    const now = Date.now();
    await activity.patch({ completedAt: now, status: 'done' });

    // Auto-plan next activity if requested
    if (args.scheduleNext) {
      const nextType = args.scheduleNext.type ?? activity.nextActivityType ?? activity.type;
      const delayDays = args.scheduleNext.delayInDays ?? 7;

      await ctx.table('activities').insert({
        title: `Follow-up: ${activity.title}`,
        type: nextType as any,
        entityType: activity.entityType as any,
        entityId: activity.entityId as any,
        scheduledAt: now + delayDays * 24 * 60 * 60 * 1000,
        dueAt: now + delayDays * 24 * 60 * 60 * 1000,
        status: 'planned',
        priority: (activity as any).priority ?? undefined,
        assigneeId: activity.assigneeId ?? undefined,
        organizationId: orgId,
        createdBy: ctx.user._id,
      });
    }
  },
});

// Cancel a planned activity.
export const cancelActivity = createOrgMutation()({
  args: {
    id: zid('activities'),
  },
  handler: async (ctx, args) => {
    const { orgId } = ctx;

    const activity = await ctx.table('activities').getX(args.id);

    if (activity.organizationId !== orgId) {
      throw new ConvexError({
        code: 'UNAUTHORIZED',
        message: 'No active organization',
      });
    }

    await activity.patch({ status: 'cancelled' });
  },
});

// Reschedule a planned activity.
export const reschedule = createOrgMutation()({
  args: {
    id: zid('activities'),
    scheduledAt: z.number(),
  },
  handler: async (ctx, args) => {
    const { orgId } = ctx;

    const activity = await ctx.table('activities').getX(args.id);

    if (activity.organizationId !== orgId) {
      throw new ConvexError({
        code: 'UNAUTHORIZED',
        message: 'No active organization',
      });
    }

    await activity.patch({ scheduledAt: args.scheduledAt, dueAt: args.scheduledAt });
  },
});

// Update an activity's fields.
export const update = createOrgMutation()({
  args: {
    id: zid('activities'),
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    dueAt: z.number().optional(),
    type: activityTypeSchema.optional(),
    assigneeId: zid('user').optional(),
    metadata: z.record(z.string(), z.any()).optional(),
    priority: prioritySchema.optional(),
  },
  handler: async (ctx, args) => {
    const { orgId } = ctx;

    const activity = await ctx.table('activities').getX(args.id);

    if (activity.organizationId !== orgId) {
      throw new ConvexError({
        code: 'UNAUTHORIZED',
        message: 'No active organization',
      });
    }

    const { id, ...fields } = args;
    await activity.patch(fields);
  },
});
