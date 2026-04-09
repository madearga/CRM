import { zid } from 'convex-helpers/server/zod';
import { ConvexError } from 'convex/values';
import { z } from 'zod';

import { createAuthMutation, createAuthQuery } from './functions';

const activityTypeSchema = z.enum([
  'call',
  'email',
  'meeting',
  'note',
  'status_change',
]);

const entityTypeSchema = z.enum(['company', 'contact', 'deal']);

// List activities for a specific entity, ordered by creation time desc.
// Activities are never soft-deleted and always show regardless of archive status.
export const activitiesForEntity = createAuthQuery()({
  args: {
    entityType: entityTypeSchema,
    entityId: z.string(),
  },
  handler: async (ctx, args) => {
    const orgId = ctx.user.activeOrganization?.id;
    if (!orgId) {
      throw new ConvexError({
        code: 'UNAUTHORIZED',
        message: 'No active organization',
      });
    }

    return await ctx
      .table('activities', 'organizationId_entityType_entityId', (q) =>
        q.eq('organizationId', orgId).eq('entityType', args.entityType).eq('entityId', args.entityId)
      )
      .order('desc');
  },
});

// Backward-compatible alias.
export const listByEntity = activitiesForEntity;

// List recent activities for the current org (dashboard).
export const listRecent = createAuthQuery()({
  args: {},
  handler: async (ctx) => {
    const orgId = ctx.user.activeOrganization?.id;
    if (!orgId) {
      throw new ConvexError({
        code: 'UNAUTHORIZED',
        message: 'No active organization',
      });
    }

    return await ctx
      .table('activities', 'organizationId_createdAt', (q) =>
        q.eq('organizationId', orgId)
      )
      .order('desc')
      .take(20);
  },
});

// List upcoming activities (dueAt in future, not completed) for the current user.
export const listUpcoming = createAuthQuery()({
  args: {},
  handler: async (ctx) => {
    const orgId = ctx.user.activeOrganization?.id;
    if (!orgId) {
      throw new ConvexError({
        code: 'UNAUTHORIZED',
        message: 'No active organization',
      });
    }

    const now = Date.now();

    return await ctx
      .table('activities', 'assigneeId_dueAt', (q) =>
        q.eq('assigneeId', ctx.user._id).gt('dueAt', now)
      )
      .filter((q) => q.eq(q.field('completedAt'), undefined));
  },
});

// Create a new activity.
export const create = createAuthMutation()({
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
    const orgId = ctx.user.activeOrganization?.id;
    if (!orgId) {
      throw new ConvexError({
        code: 'UNAUTHORIZED',
        message: 'No active organization',
      });
    }

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

// Mark an activity as completed.
export const complete = createAuthMutation()({
  args: {
    id: zid('activities'),
  },
  handler: async (ctx, args) => {
    const activity = await ctx.table('activities').getX(args.id);

    const orgId = ctx.user.activeOrganization?.id;
    if (!orgId || activity.organizationId !== orgId) {
      throw new ConvexError({
        code: 'UNAUTHORIZED',
        message: 'No active organization',
      });
    }

    await activity.patch({ completedAt: Date.now() });
  },
});

// Update an activity's fields.
export const update = createAuthMutation()({
  args: {
    id: zid('activities'),
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    dueAt: z.number().optional(),
    type: activityTypeSchema.optional(),
    assigneeId: zid('user').optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  },
  handler: async (ctx, args) => {
    const activity = await ctx.table('activities').getX(args.id);

    const orgId = ctx.user.activeOrganization?.id;
    if (!orgId || activity.organizationId !== orgId) {
      throw new ConvexError({
        code: 'UNAUTHORIZED',
        message: 'No active organization',
      });
    }

    const { id, ...fields } = args;
    await activity.patch(fields);
  },
});
