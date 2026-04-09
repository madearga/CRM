import { ConvexError } from 'convex/values';
import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod';

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
    agingDeals: z.array(
      z.object({
        id: zid('deals'),
        title: z.string(),
        stage: z.string(),
        value: z.number().optional(),
        daysInStage: z.number(),
        isAging: z.boolean(),
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

    // Aging deals — deals stuck in a stage beyond historical average
    const DAY_MS = 86_400_000;
    const allDealsForAging = await ctx
      .table('deals', 'organizationId', (q) => q.eq('organizationId', orgId))
      .take(500);
    const activeDeals = allDealsForAging.filter((d) => !d.archivedAt && d.stage !== 'won' && d.stage !== 'lost');

    let avgDaysPerStage = 14;
    const wonDeals = allDealsForAging.filter((d) => d.stage === 'won' && (d as any).stageEnteredAt);
    if (wonDeals.length >= 3) {
      const totalDays = wonDeals.reduce((sum, d) => {
        const cycleDays = d.wonAt && (d as any).stageEnteredAt
          ? (d.wonAt - (d as any).stageEnteredAt) / DAY_MS
          : 30;
        return sum + Math.min(cycleDays, 365);
      }, 0);
      avgDaysPerStage = Math.max(Math.round(totalDays / wonDeals.length / 3), 7);
    }

    const agingDeals = activeDeals
      .map((deal) => {
        const enteredAt = (deal as any).stageEnteredAt ?? deal._creationTime;
        const daysInStage = Math.floor((now - enteredAt) / DAY_MS);
        return {
          id: deal._id,
          title: deal.title,
          stage: deal.stage,
          value: deal.value,
          daysInStage,
          isAging: daysInStage > avgDaysPerStage,
        };
      })
      .filter((d) => d.isAging)
      .sort((a, b) => b.daysInStage - a.daysInStage);

    return {
      pipelineValue,
      totalDeals,
      totalCompanies,
      totalActivities,
      dealsByStage,
      recentActivities,
      upcomingActivities,
      agingDeals,
    };
  },
});

// Deal aging analysis — deals stuck in a stage beyond historical average
export const agingDeals = createAuthQuery()({
  args: {},
  returns: z.array(
    z.object({
      id: zid('deals'),
      title: z.string(),
      stage: z.string(),
      value: z.number().optional(),
      stageEnteredAt: z.number().optional(),
      daysInStage: z.number(),
      isAging: z.boolean(),
    })
  ),
  handler: async (ctx) => {
    const orgId = ctx.user.activeOrganization?.id;
    if (!orgId) {
      throw new ConvexError({ code: 'UNAUTHORIZED', message: 'No active organization' });
    }

    const now = Date.now();
    const DAY_MS = 86_400_000;

    // Fetch all active deals for the org
    const allDeals = await ctx
      .table('deals', 'organizationId', (q) => q.eq('organizationId', orgId))
      .take(500);

    const activeDeals = allDeals.filter((d) => !d.archivedAt && d.stage !== 'won' && d.stage !== 'lost');

    if (activeDeals.length === 0) return [];

    // Compute average days per stage from all won deals (historical baseline)
    const wonDeals = allDeals.filter((d) => d.stage === 'won' && d.stageEnteredAt);
    let avgDaysPerStage = 14; // default: 14 days

    if (wonDeals.length >= 3) {
      // Use won deals to estimate average cycle time
      const totalDays = wonDeals.reduce((sum, d) => {
        const cycleDays = d.wonAt && d.stageEnteredAt
          ? (d.wonAt - d.stageEnteredAt) / DAY_MS
          : 30; // fallback
        return sum + Math.min(cycleDays, 365); // cap outliers
      }, 0);
      avgDaysPerStage = Math.max(Math.round(totalDays / wonDeals.length / 3), 7); // ~3 stages, min 7 days
    }

    // Find deals that have been in their current stage too long
    return activeDeals
      .map((deal) => {
        const enteredAt = deal.stageEnteredAt ?? deal._creationTime;
        const daysInStage = Math.floor((now - enteredAt) / DAY_MS);
        return {
          id: deal._id,
          title: deal.title,
          stage: deal.stage,
          value: deal.value,
          stageEnteredAt: deal.stageEnteredAt,
          daysInStage,
          isAging: daysInStage > avgDaysPerStage,
        };
      })
      .filter((d) => d.isAging)
      .sort((a, b) => b.daysInStage - a.daysInStage);
  },
});
