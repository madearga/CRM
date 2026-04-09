import { ConvexError } from 'convex/values';
import { z } from 'zod';

import { createAuthQuery } from './functions';
import {
  aggregateCompaniesByOrg,
  aggregateDealsByOrg,
  aggregateDealsByStage,
  aggregateActivitiesByOrg,
} from './aggregates';

// Dashboard overview: pipeline value, deal counts by stage, company count, recent activities
export const overview = createAuthQuery()({
  args: {},
  returns: z.object({
    pipelineValue: z.number(),
    totalDeals: z.number(),
    totalCompanies: z.number(),
    totalActivities: z.number(),
    dealsByStage: z.array(
      z.object({
        stage: z.string(),
        count: z.number(),
        value: z.number(),
      })
    ),
    recentActivities: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        type: z.string(),
        entityType: z.string(),
        entityId: z.string(),
        createdAt: z.number(),
      })
    ),
    upcomingActivities: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        type: z.string(),
        entityType: z.string(),
        entityId: z.string(),
        dueAt: z.number(),
      })
    ),
  }),
  handler: async (ctx) => {
    const orgId = ctx.user.activeOrganization?.id;
    if (!orgId) {
      throw new ConvexError({
        code: 'UNAUTHORIZED',
        message: 'No active organization',
      });
    }

    const ns = { namespace: orgId };
    const stages = ['new', 'contacted', 'proposal', 'won', 'lost'];

    // Aggregate counts
    const [totalDeals, pipelineValue, totalCompanies, totalActivities, stageCounts, stageValues] =
      await Promise.all([
        aggregateDealsByOrg.count(ctx, ns),
        aggregateDealsByOrg.sum(ctx, ns),
        aggregateCompaniesByOrg.count(ctx, ns),
        aggregateActivitiesByOrg.count(ctx, ns),
        aggregateDealsByStage.countBatch(
          ctx,
          stages.map((stage) => ({
            namespace: orgId,
            bounds: {
              lower: { key: stage, inclusive: true },
              upper: { key: stage, inclusive: true },
            },
          }))
        ),
        aggregateDealsByStage.sumBatch(
          ctx,
          stages.map((stage) => ({
            namespace: orgId,
            bounds: {
              lower: { key: stage, inclusive: true },
              upper: { key: stage, inclusive: true },
            },
          }))
        ),
      ]);

    const dealsByStage = stages.map((stage, i) => ({
      stage,
      count: stageCounts[i],
      value: stageValues[i],
    }));

    // Recent activities (last 10)
    const recentActivities = await ctx
      .table('activities', 'organizationId_createdAt', (q) =>
        q.eq('organizationId', orgId)
      )
      .order('desc')
      .take(10)
      .map((a) => ({
        id: a._id,
        title: a.title,
        type: a.type,
        entityType: a.entityType,
        entityId: a.entityId,
        createdAt: a._creationTime,
      }));

    // Upcoming activities (next 10 with dueAt)
    const now = Date.now();
    const upcomingActivities = await ctx
      .table('activities', 'assigneeId_dueAt', (q) =>
        q.eq('assigneeId', ctx.user._id).gt('dueAt', now)
      )
      .filter((q) =>
        q.and(
          q.eq(q.field('organizationId'), orgId),
          q.eq(q.field('completedAt'), undefined)
        )
      )
      .take(10)
      .map((a) => ({
        id: a._id,
        title: a.title,
        type: a.type,
        entityType: a.entityType,
        entityId: a.entityId,
        dueAt: a.dueAt!,
      }));

    return {
      pipelineValue,
      totalDeals,
      totalCompanies,
      totalActivities,
      dealsByStage,
      recentActivities,
      upcomingActivities,
    };
  },
});
