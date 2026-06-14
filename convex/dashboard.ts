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
      .table('activities', 'assigneeId_organizationId_dueAt', (q) =>
        q.eq('assigneeId', ctx.user._id)
          .eq('organizationId', orgId)
          .gt('dueAt', now)
      )
      .filter((q) => q.eq(q.field('completedAt'), undefined))
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
    // Fetch active and won deals separately using targeted queries
    const [activeDealsRaw, wonDealsRaw] = await Promise.all([
      ctx
        .table('deals', 'organizationId', (q) => q.eq('organizationId', orgId))
        .take(200),
      ctx
        .table('deals', 'organizationId_stage', (q) => q.eq('organizationId', orgId).eq('stage', 'won'))
        .take(100),
    ]);
    const activeDeals = activeDealsRaw.filter((d) => !d.archivedAt && d.stage !== 'won' && d.stage !== 'lost');

    let avgDaysPerStage = 14;
    const wonDeals = wonDealsRaw.filter((d) => (d as any).stageEnteredAt);
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

    // Fetch active and won deals separately using targeted queries
    const [activeDealsRaw, wonDealsRaw] = await Promise.all([
      ctx
        .table('deals', 'organizationId', (q) => q.eq('organizationId', orgId))
        .take(200),
      ctx
        .table('deals', 'organizationId_stage', (q) => q.eq('organizationId', orgId).eq('stage', 'won'))
        .take(100),
    ]);

    const activeDeals = activeDealsRaw.filter((d) => !d.archivedAt && d.stage !== 'won' && d.stage !== 'lost');

    if (activeDeals.length === 0) return [];

    // Compute average days per stage from all won deals (historical baseline)
    const wonDeals = wonDealsRaw.filter((d) => d.stageEnteredAt);
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

// ---------------------------------------------------------------------------
// Mobile dashboard overview — all MVP KPIs in a single round trip.
// Business KPIs (deals, invoices, revenue) are org-scoped.
// Activity items are scoped to the calling user (their attention list),
// mirroring the `upcomingActivities` pattern in `overview`.
// ---------------------------------------------------------------------------
export const mobileOverview = createAuthQuery()({
  args: {},
  returns: z.object({
    openDealsCount: z.number(),
    overdueActivitiesCount: z.number(),
    overdueInvoicesTotal: z.number(),
    revenueMTD: z.number(),
    recentActivities: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        type: z.string(),
        entityType: z.string(),
        entityId: z.string(),
        dueAt: z.number(),
      })
    ),
    overdueInvoices: z.array(
      z.object({
        id: z.string(),
        number: z.string(),
        amountDue: z.number(),
        totalAmount: z.number(),
        dueDate: z.number(),
        currency: z.string().optional(),
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

    const now = Date.now();

    // Start of the current calendar month (for revenue MTD).
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStartMs = monthStart.getTime();

    // Fetch all independent data in parallel so this stays a single round trip.
    const [orgDeals, userActivities, postedInvoices, invoicesSinceMonthStart] =
      await Promise.all([
        // Open deals: not archived, not won, not lost (org-scoped pipeline health).
        ctx
          .table('deals', 'organizationId', (q) =>
            q.eq('organizationId', orgId)
          )
          .take(1000),
        // Calling user's activities with a due date (uses
        // assigneeId_organizationId_dueAt index).
        ctx
          .table('activities', 'assigneeId_organizationId_dueAt', (q) =>
            q.eq('assigneeId', ctx.user._id).eq('organizationId', orgId)
          )
          .take(500),
        // Posted invoices -> source for overdue total + top-5 list.
        ctx
          .table('invoices', 'organizationId_state', (q) =>
            q.eq('organizationId', orgId).eq('state', 'posted')
          )
          .take(2000),
        // Invoices dated this month -> source for revenue MTD.
        ctx
          .table('invoices', 'organizationId_invoiceDate', (q) =>
            q.eq('organizationId', orgId).gte('invoiceDate', monthStartMs)
          )
          .take(2000),
      ]);

    // --- Open deals count ---
    const openDealsCount = orgDeals.filter(
      (d) => !d.archivedAt && d.stage !== 'won' && d.stage !== 'lost'
    ).length;

    // --- Activities: open = not completed / not cancelled; must have a dueAt ---
    const openUserActivities = userActivities.filter(
      (a) =>
        a.dueAt !== undefined &&
        a.completedAt === undefined &&
        a.status !== 'done' &&
        a.status !== 'cancelled'
    );
    const overdueActivitiesCount = openUserActivities.filter(
      (a) => a.dueAt! < now
    ).length;

    // Recent/upcoming activities for the user: soonest due first (overdue
    // surfaces at the top so it gets attention). Top 5.
    const recentActivities = [...openUserActivities]
      .sort((a, b) => a.dueAt! - b.dueAt!)
      .slice(0, 5)
      .map((a) => ({
        id: a._id,
        title: a.title,
        type: a.type,
        entityType: a.entityType,
        entityId: a.entityId,
        dueAt: a.dueAt!,
      }));

    // --- Overdue invoices: posted, not archived, past dueDate ---
    const overdueInvoiceList = postedInvoices
      .filter((inv) => !inv.archivedAt && inv.dueDate < now)
      .sort((a, b) => a.dueDate - b.dueDate); // most overdue first
    const overdueInvoicesTotal = overdueInvoiceList.reduce(
      (sum, inv) => sum + (inv.amountDue ?? 0),
      0
    );
    const overdueInvoices = overdueInvoiceList.slice(0, 5).map((inv) => ({
      id: inv._id,
      number: inv.number,
      amountDue: inv.amountDue ?? 0,
      totalAmount: inv.totalAmount ?? 0,
      dueDate: inv.dueDate,
      currency: inv.currency,
    }));

    // --- Revenue MTD: customer invoices this month, not cancelled/archived ---
    const revenueMTD = invoicesSinceMonthStart
      .filter(
        (inv) =>
          inv.type === 'customer_invoice' &&
          inv.state !== 'cancel' &&
          !inv.archivedAt
      )
      .reduce((sum, inv) => sum + (inv.totalAmount ?? 0), 0);

    return {
      openDealsCount,
      overdueActivitiesCount,
      overdueInvoicesTotal,
      revenueMTD,
      recentActivities,
      overdueInvoices,
    };
  },
});
