import { zid } from 'convex-helpers/server/zod';
import { z } from 'zod';

import { createAuthQuery } from './functions';
import {
  bucketsForPeriod,
  dashboardRangeSchema,
  lostDealsInPeriod,
  percentDelta,
  resolveComparisonPeriods,
  revenueInvoicesInPeriod,
  saleOrdersInPeriod,
  sumRevenue,
  winRate,
  wonDealsInPeriod,
  type DashboardRange,
} from './helpers/dashboardMetrics';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

// Scoped-row cap for dashboard scans. Exceeding it fails loudly instead of
// silently dropping newer records.
const DASHBOARD_SCAN_CAP = 20_000;

function assertScanCap(count: number, what: string) {
  if (count > DASHBOARD_SCAN_CAP) {
    throw new Error(
      `${what} exceeds the dashboard scan cap of ${DASHBOARD_SCAN_CAP} rows; narrow the range or archive old records`
    );
  }
}

function monthRange(monthsAgo: number) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() - monthsAgo;
  const d = new Date(year, month, 1);
  const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  return { start, end };
}

function formatMonth(ms: number) {
  const d = new Date(ms);
  return d.toLocaleString('en-US', { year: 'numeric', month: 'short' });
}

// ---------------------------------------------------------------------------
// 0. Overview KPIs
// ---------------------------------------------------------------------------

export const getOverview = createAuthQuery()({
  args: {},
  returns: z.object({
    totalRevenue: z.number(),
    outstandingAmount: z.number(),
    overdueAmount: z.number(),
    activeDeals: z.number(),
    wonDeals: z.number(),
    totalContacts: z.number(),
    totalCompanies: z.number(),
    conversionRate: z.number(),
  }),
  handler: async (ctx) => {
    const orgId = ctx.user.activeOrganization?.id;
    if (!orgId) {
      return {
        totalRevenue: 0,
        outstandingAmount: 0,
        overdueAmount: 0,
        activeDeals: 0,
        wonDeals: 0,
        totalContacts: 0,
        totalCompanies: 0,
        conversionRate: 0,
      };
    }

    // Count deals by stage
    const deals = await ctx
      .table('deals', 'organizationId', (q) => q.eq('organizationId', orgId))
      .take(1000);
    const activeDeals = deals.filter(
      (d) => !d.archivedAt && d.stage !== 'won' && d.stage !== 'lost'
    ).length;
    const wonDeals = deals.filter((d) => !d.archivedAt && d.stage === 'won').length;
    const totalDeals = deals.filter((d) => !d.archivedAt).length;
    const conversionRate =
      totalDeals > 0 ? Math.round((wonDeals / totalDeals) * 1000) / 10 : 0;

    // Revenue from paid invoices
    const paidInvoices = await ctx
      .table('invoices', 'organizationId_state', (q) =>
        q.eq('organizationId', orgId).eq('state', 'paid')
      )
      .take(2000);
    const totalRevenue = paidInvoices.reduce(
      (sum, inv) => sum + (inv.totalAmount ?? 0),
      0
    );

    // Outstanding (posted but unpaid)
    const postedInvoices = await ctx
      .table('invoices', 'organizationId_state', (q) =>
        q.eq('organizationId', orgId).eq('state', 'posted')
      )
      .take(2000);
    const outstandingAmount = postedInvoices.reduce(
      (sum, inv) => sum + (inv.amountDue ?? 0),
      0
    );

    // Overdue (posted + past dueDate)
    const now = Date.now();
    const overdueAmount = postedInvoices
      .filter((inv) => inv.dueDate < now)
      .reduce((sum, inv) => sum + (inv.amountDue ?? 0), 0);

    // Counts
    const contacts = await ctx
      .table('contacts', 'organizationId', (q) => q.eq('organizationId', orgId))
      .take(1000);
    const companies = await ctx
      .table('companies', 'organizationId', (q) => q.eq('organizationId', orgId))
      .take(1000);

    return {
      totalRevenue,
      outstandingAmount,
      overdueAmount,
      activeDeals,
      wonDeals,
      totalContacts: contacts.length,
      totalCompanies: companies.length,
      conversionRate,
    };
  },
});

// ---------------------------------------------------------------------------
// 0b. Deal Pipeline Summary
// ---------------------------------------------------------------------------

export const getDealPipeline = createAuthQuery()({
  args: {},
  returns: z.array(
    z.object({
      stage: z.string(),
      count: z.number(),
      value: z.number(),
    })
  ),
  handler: async (ctx) => {
    const orgId = ctx.user.activeOrganization?.id;
    if (!orgId) return [];

    const deals = await ctx
      .table('deals', 'organizationId', (q) => q.eq('organizationId', orgId))
      .take(1000);

    const activeDeals = deals.filter((d) => !d.archivedAt);

    const byStage = new Map<string, { count: number; value: number }>();
    for (const deal of activeDeals) {
      const stage = deal.stage ?? 'unknown';
      const existing = byStage.get(stage) ?? { count: 0, value: 0 };
      existing.count += 1;
      existing.value += deal.value ?? 0;
      byStage.set(stage, existing);
    }

    return Array.from(byStage.entries()).map(([stage, data]) => ({
      stage,
      ...data,
    }));
  },
});

// ---------------------------------------------------------------------------
// 1. Revenue by Month (last 12 months)
// ---------------------------------------------------------------------------

export const revenueByMonth = createAuthQuery()({
  args: { range: dashboardRangeSchema.optional() },
  returns: z.array(
    z.object({
      month: z.string(),
      revenue: z.number(),
      count: z.number(),
    })
  ),
  handler: async (ctx, { range }) => {
    const orgId = ctx.user.activeOrganization?.id;
    if (!orgId) return [];

    if (range) {
      const periods = resolveComparisonPeriods(Date.now(), range);
      const invoices = await ctx.db
        .query('invoices')
        .withIndex('organizationId_invoiceDate', (q) =>
          q
            .eq('organizationId', orgId)
            .gte('invoiceDate', periods.current.start)
            .lt('invoiceDate', periods.current.end)
        )
        .collect();
      assertScanCap(invoices.length, 'invoices');
      const valid = revenueInvoicesInPeriod(invoices, periods.current);
      return bucketsForPeriod(periods.current, range as DashboardRange).map(
        (bucket) => {
          const inBucket = valid.filter(
            (inv) =>
              inv.invoiceDate >= bucket.start && inv.invoiceDate < bucket.end
          );
          return {
            month: bucket.label,
            revenue: inBucket.reduce((s, inv) => s + (inv.totalAmount ?? 0), 0),
            count: inBucket.length,
          };
        }
      );
    }

    const invoices = await ctx.db
      .query('invoices')
      .withIndex('organizationId_invoiceDate', (q) =>
        q
          .eq('organizationId', orgId)
          .gte('invoiceDate', monthRange(11).start)
          .lt('invoiceDate', monthRange(0).end)
      )
      .collect();
    assertScanCap(invoices.length, 'invoices');

    // Only customer invoices that are posted/paid (not cancelled)
    const valid = invoices.filter(
      (inv) =>
        inv.type === 'customer_invoice' &&
        inv.state !== 'cancel' &&
        inv.archivedAt == null
    );

    const months: { month: string; revenue: number; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const { start, end } = monthRange(i);
      const inMonth = valid.filter(
        (inv) => inv.invoiceDate >= start && inv.invoiceDate < end
      );
      months.push({
        month: formatMonth(start),
        revenue: inMonth.reduce((s, inv) => s + (inv.totalAmount ?? 0), 0),
        count: inMonth.length,
      });
    }

    return months;
  },
});

// ---------------------------------------------------------------------------
// 2. Sales Performance (per owner)
// ---------------------------------------------------------------------------

export const salesPerformance = createAuthQuery()({
  args: {},
  returns: z.array(
    z.object({
      ownerId: zid('user'),
      ownerName: z.string(),
      totalDeals: z.number(),
      wonDeals: z.number(),
      winRate: z.number(),
      totalValue: z.number(),
      avgCloseDays: z.number(),
    })
  ),
  handler: async (ctx) => {
    const orgId = ctx.user.activeOrganization?.id;
    if (!orgId) return [];

    const deals = await ctx
      .table('deals', 'organizationId', (q) => q.eq('organizationId', orgId))
      .take(1000);

    const activeDeals = deals.filter((d) => !d.archivedAt);

    // Group by owner
    const byOwner = new Map<
      string,
      {
        total: number;
        won: number;
        value: number;
        closeDays: number[];
      }
    >();

    for (const deal of activeDeals) {
      const id = deal.ownerId;
      let bucket = byOwner.get(id);
      if (!bucket) {
        bucket = { total: 0, won: 0, value: 0, closeDays: [] };
        byOwner.set(id, bucket);
      }
      bucket.total++;
      bucket.value += deal.value ?? 0;
      if (deal.stage === 'won') {
        bucket.won++;
        if (deal.wonAt && deal.stageEnteredAt) {
          bucket.closeDays.push(
            Math.floor((deal.wonAt - deal._creationTime) / DAY_MS)
          );
        }
      }
    }

    // Resolve owner names
    const result: Array<{ ownerId: any; ownerName: string; totalDeals: number; wonDeals: number; winRate: number; totalValue: number; avgCloseDays: number }> = [];
    for (const [ownerId, bucket] of byOwner) {
      const user = await ctx.table('user').get(ownerId as any);
      const avgCloseDays =
        bucket.closeDays.length > 0
          ? Math.round(
              bucket.closeDays.reduce((a, b) => a + b, 0) /
                bucket.closeDays.length
            )
          : 0;

      result.push({
        ownerId: ownerId as any,
        ownerName: user?.name ?? 'Unknown',
        totalDeals: bucket.total,
        wonDeals: bucket.won,
        winRate:
          bucket.total > 0
            ? Math.round((bucket.won / bucket.total) * 100)
            : 0,
        totalValue: bucket.value,
        avgCloseDays,
      });
    }

    return result.sort((a, b) => b.totalValue - a.totalValue);
  },
});

// ---------------------------------------------------------------------------
// 3. Pipeline Forecast
// ---------------------------------------------------------------------------

export const pipelineForecast = createAuthQuery()({
  args: {},
  returns: z.array(
    z.object({
      stage: z.string(),
      dealCount: z.number(),
      totalValue: z.number(),
      expectedRevenue: z.number(),
    })
  ),
  handler: async (ctx) => {
    const orgId = ctx.user.activeOrganization?.id;
    if (!orgId) return [];

    const deals = await ctx
      .table('deals', 'organizationId', (q) => q.eq('organizationId', orgId))
      .take(1000);

    const activeDeals = deals.filter((d) => !d.archivedAt);

    const stages = ['new', 'contacted', 'proposal', 'won', 'lost'] as const;
    const defaultProbability: Record<string, number> = {
      new: 10,
      contacted: 25,
      proposal: 50,
      won: 100,
      lost: 0,
    };

    const byStage = new Map<
      string,
      { count: number; totalValue: number; expectedRevenue: number }
    >();

    for (const stage of stages) {
      byStage.set(stage, { count: 0, totalValue: 0, expectedRevenue: 0 });
    }

    for (const deal of activeDeals) {
      const bucket = byStage.get(deal.stage)!;
      const value = deal.value ?? 0;
      const prob = (deal.probability ?? defaultProbability[deal.stage]) / 100;
      bucket.count++;
      bucket.totalValue += value;
      bucket.expectedRevenue += value * prob;
    }

    return stages
      .filter((s) => s !== 'lost')
      .map((stage) => {
        const bucket = byStage.get(stage)!;
        return {
          stage,
          dealCount: bucket.count,
          totalValue: bucket.totalValue,
          expectedRevenue: bucket.expectedRevenue,
        };
      });
  },
});

// ---------------------------------------------------------------------------
// 4. Invoice Aging (overdue invoices grouped by bucket)
// ---------------------------------------------------------------------------

export const invoiceAging = createAuthQuery()({
  args: {},
  returns: z.array(
    z.object({
      bucket: z.string(),
      count: z.number(),
      totalAmount: z.number(),
    })
  ),
  handler: async (ctx) => {
    const orgId = ctx.user.activeOrganization?.id;
    if (!orgId) return [];

    const now = Date.now();
    const invoices = await ctx
      .table('invoices', 'organizationId_invoiceDate', (q) =>
        q.eq('organizationId', orgId)
      )
      .take(2000);

    // Overdue: not cancelled, not fully paid, dueDate < now
    const overdue = invoices.filter(
      (inv) =>
        inv.state !== 'cancel' &&
        inv.state !== 'paid' &&
        !inv.archivedAt &&
        inv.dueDate < now
    );

    const buckets = [
      { label: '0-30 days', min: 0, max: 30 },
      { label: '31-60 days', min: 31, max: 60 },
      { label: '61-90 days', min: 61, max: 90 },
      { label: '90+ days', min: 91, max: Infinity },
    ];

    return buckets.map(({ label, min, max }) => {
      const inBucket = overdue.filter((inv) => {
        const days = Math.floor((now - inv.dueDate) / DAY_MS);
        return days >= min && days <= max;
      });
      return {
        bucket: label,
        count: inBucket.length,
        totalAmount: inBucket.reduce((s, inv) => s + (inv.amountDue ?? 0), 0),
      };
    });
  },
});

// ---------------------------------------------------------------------------
// 5. Top Products (by revenue from saleOrderLines)
// ---------------------------------------------------------------------------

export const topProducts = createAuthQuery()({
  args: { range: dashboardRangeSchema.optional() },
  returns: z.array(
    z.object({
      productId: zid('products').optional(),
      productName: z.string(),
      totalQty: z.number(),
      totalRevenue: z.number(),
    })
  ),
  handler: async (ctx, { range }) => {
    const orgId = ctx.user.activeOrganization?.id;
    if (!orgId) return [];

    // Get sale order lines via saleOrders
    const period = range
      ? resolveComparisonPeriods(Date.now(), range).current
      : null;
    const saleOrders = await (period
      ? ctx.table('saleOrders', 'organizationId_orderDate', (q) =>
          q.eq('organizationId', orgId)
            .gte('orderDate', period.start)
            .lt('orderDate', period.end)
        )
      : ctx.table('saleOrders', 'organizationId', (q) => q.eq('organizationId', orgId))
    ).take(DASHBOARD_SCAN_CAP + 1);
    assertScanCap(saleOrders.length, 'sale orders');

    const activeOrders = period
      ? saleOrdersInPeriod(saleOrders, period)
      : saleOrders.filter(
          (so) => so.state !== 'cancel' && so.archivedAt == null
        );

    // Accumulate lines
    const productMap = new Map<
      string,
      { name: string; qty: number; revenue: number; productId: any }
    >();

    for (const order of activeOrders) {
      const lines = await order.edge('lines');
      for (const line of lines) {
        const key = line.productId ?? line.productName;
        let entry = productMap.get(key);
        if (!entry) {
          entry = {
            name: line.productName,
            qty: 0,
            revenue: 0,
            productId: line.productId,
          };
          productMap.set(key, entry);
        }
        entry.qty += line.quantity;
        entry.revenue += line.subtotal ?? line.quantity * line.unitPrice;
      }
    }

    return Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map((p) => ({
        productId: p.productId,
        productName: p.name,
        totalQty: p.qty,
        totalRevenue: p.revenue,
      }));
  },
});

// ---------------------------------------------------------------------------
// 6. Conversion Funnel
// ---------------------------------------------------------------------------

export const conversionFunnel = createAuthQuery()({
  args: {},
  returns: z.array(
    z.object({
      stage: z.string(),
      count: z.number(),
      conversionRate: z.number(),
    })
  ),
  handler: async (ctx) => {
    const orgId = ctx.user.activeOrganization?.id;
    if (!orgId) return [];

    const deals = await ctx
      .table('deals', 'organizationId', (q) => q.eq('organizationId', orgId))
      .take(1000);

    const activeDeals = deals.filter((d) => !d.archivedAt);

    const stages = ['new', 'contacted', 'proposal', 'won'];
    const stageCounts: Record<string, number> = {};
    for (const stage of stages) {
      stageCounts[stage] = 0;
    }
    for (const deal of activeDeals) {
      if (stageCounts[deal.stage] !== undefined) {
        stageCounts[deal.stage]++;
      }
    }

    const firstCount = stageCounts[stages[0]] || 1;
    return stages.map((stage) => ({
      stage,
      count: stageCounts[stage],
      conversionRate:
        firstCount > 0
          ? Math.round((stageCounts[stage] / firstCount) * 100)
          : 0,
    }));
  },
});

// ---------------------------------------------------------------------------
// 7. Monthly Comparison
// ---------------------------------------------------------------------------

export const monthlyComparison = createAuthQuery()({
  args: { range: dashboardRangeSchema.optional() },
  returns: z.object({
    current: z.object({
      dealsCreated: z.number(),
      dealsWon: z.number(),
      dealsLost: z.number(),
      winRate: z.number().nullable(),
      revenue: z.number(),
      newCompanies: z.number(),
    }),
    previous: z.object({
      dealsCreated: z.number(),
      dealsWon: z.number(),
      dealsLost: z.number(),
      winRate: z.number().nullable(),
      revenue: z.number(),
      newCompanies: z.number(),
    }),
    change: z.object({
      dealsCreated: z.number().nullable(),
      dealsWon: z.number().nullable(),
      revenue: z.number().nullable(),
      newCompanies: z.number().nullable(),
    }),
    period: z.object({
      start: z.number(),
      end: z.number(),
      previousStart: z.number(),
      previousEnd: z.number(),
      label: z.string(),
      comparisonLabel: z.string(),
    }),
  }),
  handler: async (ctx, { range: rangeArg }) => {
    const orgId = ctx.user.activeOrganization?.id;
    const range = rangeArg ?? 'this_month';
    const { current, previous, label, comparisonLabel } =
      resolveComparisonPeriods(Date.now(), range);
    if (!orgId) {
      return {
        current: {
          dealsCreated: 0,
          dealsWon: 0,
          dealsLost: 0,
          winRate: null,
          revenue: 0,
          newCompanies: 0,
        },
        previous: {
          dealsCreated: 0,
          dealsWon: 0,
          dealsLost: 0,
          winRate: null,
          revenue: 0,
          newCompanies: 0,
        },
        change: {
          dealsCreated: 0,
          dealsWon: 0,
          revenue: 0,
          newCompanies: 0,
        },
        period: {
          start: current.start,
          end: current.end,
          previousStart: previous.start,
          previousEnd: previous.end,
          label,
          comparisonLabel,
        },
      };
    }

    const { start: curStart, end: curEnd } = current;
    const { start: prevStart, end: prevEnd } = previous;

    // Fetch data. Invoice bounds cover both periods; deals and companies
    // have no usable time index, so scoped rows are collected and capped.
    const [deals, invoices, companies] = await Promise.all([
      ctx.db
        .query('deals')
        .withIndex('organizationId', (q) => q.eq('organizationId', orgId))
        .collect(),
      ctx.db
        .query('invoices')
        .withIndex('organizationId_invoiceDate', (q) =>
          q
            .eq('organizationId', orgId)
            .gte('invoiceDate', prevStart)
            .lt('invoiceDate', curEnd)
        )
        .collect(),
      ctx.db
        .query('companies')
        .withIndex('organizationId', (q) => q.eq('organizationId', orgId))
        .collect(),
    ]);
    assertScanCap(deals.length, 'deals');
    assertScanCap(invoices.length, 'invoices');
    assertScanCap(companies.length, 'companies');

    const curDealsCreated = deals.filter(
      (d) => d._creationTime >= curStart && d._creationTime < curEnd
    ).length;
    const curWon = wonDealsInPeriod(deals, current);
    const curLost = lostDealsInPeriod(deals, current);
    const curDealsWon = curWon.length;
    const curDealsLost = curLost.length;
    const curRevenue = sumRevenue(revenueInvoicesInPeriod(invoices, current));
    const curCompanies = companies.filter(
      (c) => c._creationTime >= curStart && c._creationTime < curEnd
    ).length;

    const prevDealsCreated = deals.filter(
      (d) => d._creationTime >= prevStart && d._creationTime < prevEnd
    ).length;
    const prevWon = wonDealsInPeriod(deals, previous);
    const prevLost = lostDealsInPeriod(deals, previous);
    const prevDealsWon = prevWon.length;
    const prevDealsLost = prevLost.length;
    const prevRevenue = sumRevenue(revenueInvoicesInPeriod(invoices, previous));
    const prevCompanies = companies.filter(
      (c) => c._creationTime >= prevStart && c._creationTime < prevEnd
    ).length;

    return {
      current: {
        dealsCreated: curDealsCreated,
        dealsWon: curDealsWon,
        dealsLost: curDealsLost,
        winRate: winRate(curDealsWon, curDealsLost),
        revenue: curRevenue,
        newCompanies: curCompanies,
      },
      previous: {
        dealsCreated: prevDealsCreated,
        dealsWon: prevDealsWon,
        dealsLost: prevDealsLost,
        winRate: winRate(prevDealsWon, prevDealsLost),
        revenue: prevRevenue,
        newCompanies: prevCompanies,
      },
      change: {
        dealsCreated: percentDelta(curDealsCreated, prevDealsCreated),
        dealsWon: percentDelta(curDealsWon, prevDealsWon),
        revenue: percentDelta(curRevenue, prevRevenue),
        newCompanies: percentDelta(curCompanies, prevCompanies),
      },
      period: {
        start: curStart,
        end: curEnd,
        previousStart: prevStart,
        previousEnd: prevEnd,
        label,
        comparisonLabel,
      },
    };
  },

});
