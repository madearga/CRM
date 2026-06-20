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

import {
  OPEN_DEAL_STAGES,
  isOpenActivity,
  isOverdueActivity,
  isInvoiceOverdue,
  isRevenueInvoice,
  monthStartOf,
  type DashboardInvoice,
} from '@crm/domain';

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
    const monthStartMs = monthStartOf(now);

    // ---------------------------------------------------------------
    // Read budget guard
    //
    // P0 fix: the previous implementation loaded up to 5,500 documents
    // (deals 1000 + activities 500 + posted invoices 2000 + month invoices
    // 2000) in a single round trip. For real workspaces this risks
    // hitting Convex function read/byte limits. We now use targeted
    // index queries with per-source caps:
    //
    //   - open deals: one targeted `organizationId_stage` query per open
    //     stage (new/contacted/proposal). Aggregate counts by stage exist
    //     (`aggregateDealsByStage`) but they cannot exclude archived
    //     deals, so per-stage queries with cap are the correct
    //     alternative. Each stage is bounded by OPEN_DEALS_PER_STAGE_CAP.
    //   - overdue activities: `assigneeId_organizationId_dueAt` with
    //     `lt('dueAt', now)` — only past-due rows.
    //   - recent activities: ordered `assigneeId_organizationId_dueAt`
    //     asc, bounded window, then filter to open.
    //   - overdue invoices: `organizationId_dueDate` with `lt('dueDate',
    //     now)` — only past-due rows. P1 fix adds the
    //     `amountDue > 0 && paymentStatus !== 'paid'` guard so
    //     fully-paid-but-still-posted invoices do not inflate the
    //     overdue total.
    //   - revenue MTD: `organizationId_invoiceDate` gte monthStart.
    //
    // Aggregates were not available for the multi-field filters needed
    // (state + archivedAt + amountDue + paymentStatus). We use
    // capped/targeted queries instead. Caps are documented; raise them
    // in the same PR if a real workspace reports under-counts.
    // ---------------------------------------------------------------
    const OPEN_DEALS_PER_STAGE_CAP = 500;
    const OVERDUE_ACTIVITIES_CAP = 200;
    const RECENT_ACTIVITIES_FETCH = 25;
    const OVERDUE_INVOICES_CAP = 500;
    const REVENUE_MTD_INVOICES_CAP = 1000;

    const openStageQueries = OPEN_DEAL_STAGES.map((stage) =>
      ctx
        .table('deals', 'organizationId_stage', (q) =>
          q.eq('organizationId', orgId).eq('stage', stage)
        )
        .take(OPEN_DEALS_PER_STAGE_CAP)
    );

    const [openDealsByStage, overdueActivityRows, recentActivityRows, pastDueInvoices, monthInvoices] =
      await Promise.all([
        Promise.all(openStageQueries),
        ctx
          .table('activities', 'assigneeId_organizationId_dueAt', (q) =>
            q
              .eq('assigneeId', ctx.user._id)
              .eq('organizationId', orgId)
              .lt('dueAt', now)
          )
          .take(OVERDUE_ACTIVITIES_CAP),
        ctx
          .table('activities', 'assigneeId_organizationId_dueAt', (q) =>
            q.eq('assigneeId', ctx.user._id).eq('organizationId', orgId)
          )
          .order('asc')
          .take(RECENT_ACTIVITIES_FETCH),
        ctx
          .table('invoices', 'organizationId_dueDate', (q) =>
            q.eq('organizationId', orgId).lt('dueDate', now)
          )
          .take(OVERDUE_INVOICES_CAP),
        ctx
          .table('invoices', 'organizationId_invoiceDate', (q) =>
            q.eq('organizationId', orgId).gte('invoiceDate', monthStartMs)
          )
          .take(REVENUE_MTD_INVOICES_CAP),
      ]);

    // --- Open deals count ---
    // Flatten per-stage results and filter archived; archived open-stage
    // deals must not inflate the pipeline-health count.
    const openDealsCount = openDealsByStage
      .flat()
      .filter((d) => d.archivedAt === undefined).length;

    // --- Activities ---
    // Overdue: open (planned, not done/cancelled, not completed) AND past due.
    const overdueActivitiesCount = overdueActivityRows.filter((a) =>
      isOverdueActivity(a, now)
    ).length;

    // Recent: top 5 open user activities by dueAt ascending (overdue first).
    const recentActivities = recentActivityRows
      .filter((a) => isOpenActivity(a) && typeof a.dueAt === 'number')
      .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0))
      .slice(0, 5)
      .map((a) => ({
        id: a._id,
        title: a.title,
        type: a.type,
        entityType: a.entityType,
        entityId: a.entityId,
        dueAt: a.dueAt as number,
      }));

    // --- Overdue invoices ---
    // P1 fix: require amountDue > 0 and paymentStatus !== 'paid' so that
    // posted invoices which have been fully settled (state not transitioned
    // to 'paid') do not inflate the overdue total. Filters live in the
    // shared `isInvoiceOverdue` classifier (see @crm/domain/dashboard).
    const overdueInvoiceList = (pastDueInvoices as unknown as DashboardInvoice[])
      .filter((inv) => isInvoiceOverdue(inv, now))
      .sort((a, b) => a.dueDate - b.dueDate);
    const overdueInvoicesTotal = overdueInvoiceList.reduce(
      (sum, inv) => sum + (inv.amountDue ?? 0),
      0
    );
    const overdueInvoices = overdueInvoiceList.slice(0, 5).map((inv) => ({
      id: (inv as any)._id,
      number: (inv as any).number,
      amountDue: inv.amountDue ?? 0,
      totalAmount: inv.totalAmount ?? 0,
      dueDate: inv.dueDate,
      currency: (inv as any).currency,
    }));

    // --- Revenue MTD ---
    const revenueMTD = (monthInvoices as unknown as DashboardInvoice[])
      .filter((inv) => isRevenueInvoice(inv))
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
