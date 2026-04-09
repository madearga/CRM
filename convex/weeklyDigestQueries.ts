import { zid } from 'convex-helpers/server/zod';
import type { Id } from './_generated/dataModel';
import { z } from 'zod';

import { createInternalQuery } from './functions';

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const ACTIVE_STAGES = new Set(['new', 'contacted', 'proposal']);

export const listDigestTargets = createInternalQuery()({
  args: {},
  returns: z.array(
    z.object({
      currency: z.string(),
      organizationId: zid('organization'),
      organizationName: z.string(),
      recipientEmails: z.array(z.string().email()),
    })
  ),
  handler: async (ctx) => {
    const organizations = await ctx.table('organization').take(500);
    const targets: {
      currency: string;
      organizationId: string & { __tableName: "organization"; };
      organizationName: string;
      recipientEmails: string[];
    }[] = [];

    for (const organization of organizations) {
      const [owners, admins] = await Promise.all([
        ctx
          .table('member', 'organizationId_role', (q) =>
            q.eq('organizationId', organization._id).eq('role', 'owner')
          )
          .take(20),
        ctx
          .table('member', 'organizationId_role', (q) =>
            q.eq('organizationId', organization._id).eq('role', 'admin')
          )
          .take(20),
      ]);

      const uniqueUserIds = new Set<string>();
      for (const member of [...owners, ...admins]) {
        uniqueUserIds.add(member.userId);
      }

      const recipientEmails = new Set<string>();
      for (const userId of (uniqueUserIds as any as Id<"user">[])) {
        const user = await ctx.table('user').get(userId);
        if (user?.email) {
          recipientEmails.add(user.email);
        }
      }

      if (recipientEmails.size === 0) {
        continue;
      }

      targets.push({
        currency: organization.settings?.currency ?? 'IDR',
        organizationId: organization._id,
        organizationName: organization.name,
        recipientEmails: Array.from(recipientEmails),
      });
    }

    return targets;
  },
});

export const getDigestMetrics = createInternalQuery()({
  args: {
    organizationId: zid('organization'),
  },
  returns: z.object({
    agingDealsCount: z.number(),
    dealsMovedLastWeek: z.number(),
    pipelineValue: z.number(),
    tasksDueThisWeek: z.number(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const oneWeekAgo = now - ONE_WEEK_MS;
    const oneWeekAhead = now + ONE_WEEK_MS;

    const [deals, activities] = await Promise.all([
      ctx
        .table('deals', 'organizationId', (q) =>
          q.eq('organizationId', args.organizationId)
        )
        .take(5000),
      ctx
        .table('activities', 'organizationId', (q) =>
          q.eq('organizationId', args.organizationId)
        )
        .take(5000),
    ]);

    const activeDeals = deals.filter(
      (deal) => !deal.archivedAt && ACTIVE_STAGES.has(deal.stage)
    );

    const pipelineValue = activeDeals.reduce((sum, deal) => sum + (deal.value ?? 0), 0);
    const agingDealsCount = activeDeals.filter(
      (deal) => now - deal._creationTime >= ONE_WEEK_MS
    ).length;

    const dealsMovedLastWeek = activities.filter(
      (activity) =>
        activity.type === 'status_change' && activity._creationTime >= oneWeekAgo
    ).length;

    const tasksDueThisWeek = activities.filter(
      (activity) =>
        activity.dueAt !== undefined &&
        activity.dueAt >= now &&
        activity.dueAt <= oneWeekAhead &&
        activity.completedAt === undefined
    ).length;

    return {
      agingDealsCount,
      dealsMovedLastWeek,
      pipelineValue,
      tasksDueThisWeek,
    };
  },
});
