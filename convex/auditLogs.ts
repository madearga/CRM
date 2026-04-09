import { zid } from 'convex-helpers/server/zod';
import { ConvexError } from 'convex/values';
import { z } from 'zod';

import { createAuthQuery } from './functions';

const entityTypeSchema = z.enum(['company', 'contact', 'deal']);

const DEFAULT_LIST_LIMIT = 50;

export const listByEntity = createAuthQuery()({
  args: {
    entityType: entityTypeSchema,
    entityId: z.string(),
  },
  returns: z.array(
    z.object({
      _id: zid('auditLogs'),
      _creationTime: z.number(),
      action: z.string(),
      before: z.any().optional(),
      after: z.any().optional(),
      metadata: z.record(z.string(), z.any()).optional(),
      entityType: entityTypeSchema,
      entityId: z.string(),
      organizationId: zid('organization'),
      actorUserId: zid('user'),
    })
  ),
  handler: async (ctx, args) => {
    const orgId = ctx.user.activeOrganization?.id;
    if (!orgId) {
      throw new ConvexError({ code: 'UNAUTHORIZED', message: 'No active organization' });
    }

    const logs = await ctx
      .table('auditLogs', 'organizationId_entityType_entityId', (q) =>
        q
          .eq('organizationId', orgId)
          .eq('entityType', args.entityType)
          .eq('entityId', args.entityId)
      )
      .order('desc')
      .take(DEFAULT_LIST_LIMIT);

    return logs.map((log) => ({
      _id: log._id,
      _creationTime: log._creationTime,
      action: log.action,
      before: log.before,
      after: log.after,
      metadata: log.metadata,
      entityType: log.entityType,
      entityId: log.entityId,
      organizationId: log.organizationId,
      actorUserId: log.actorUserId,
    }));
  },
});

export const listRecent = createAuthQuery()({
  args: {
    limit: z.number().min(1).max(100).optional(),
  },
  returns: z.array(
    z.object({
      _id: zid('auditLogs'),
      _creationTime: z.number(),
      action: z.string(),
      before: z.any().optional(),
      after: z.any().optional(),
      metadata: z.record(z.string(), z.any()).optional(),
      entityType: entityTypeSchema,
      entityId: z.string(),
      organizationId: zid('organization'),
      actorUserId: zid('user'),
    })
  ),
  handler: async (ctx, args) => {
    const orgId = ctx.user.activeOrganization?.id;
    if (!orgId) {
      throw new ConvexError({ code: 'UNAUTHORIZED', message: 'No active organization' });
    }

    const limit = args.limit ?? DEFAULT_LIST_LIMIT;

    const logs = await ctx
      .table('auditLogs', 'organizationId_createdAt', (q) => q.eq('organizationId', orgId))
      .order('desc')
      .take(limit);

    return logs.map((log) => ({
      _id: log._id,
      _creationTime: log._creationTime,
      action: log.action,
      before: log.before,
      after: log.after,
      metadata: log.metadata,
      entityType: log.entityType,
      entityId: log.entityId,
      organizationId: log.organizationId,
      actorUserId: log.actorUserId,
    }));
  },
});

export async function createAuditLog(
  ctx: any,
  args: {
    organizationId: string;
    actorUserId: string;
    entityType: 'company' | 'contact' | 'deal';
    entityId: string;
    action: string;
    before?: any;
    after?: any;
    metadata?: Record<string, any>;
  }
) {
  await ctx.table('auditLogs').insert({
    action: args.action,
    entityType: args.entityType,
    entityId: args.entityId,
    organizationId: args.organizationId,
    actorUserId: args.actorUserId,
    before: args.before,
    after: args.after,
    metadata: args.metadata,
  });
}
