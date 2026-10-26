// Real query integration tests for the dashboard metrics change.
// Uses convex-test with the real schema and the real analytics module.
// Only the session transport is mocked (same seam as the other integration
// tests). Time is frozen so the WIB periods are deterministic.
/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";

import schema from "../schema";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

// Frozen "now": 2026-03-15 10:30 WIB (2026-03-15T03:30Z). 2026 is not a leap
// year, so the previous month is February with 28 days.
const NOW = Date.UTC(2026, 2, 15, 3, 30);
const wib = (y: number, m: number, d: number, h = 0) =>
  Date.UTC(y, m - 1, d, h) - 7 * 3600_000;

const session = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
}));
vi.mock("../auth", () => ({
  authClient: { getHeaders: async () => new Headers() },
  getAuth: () => ({ api: {} }),
}));
vi.mock("../authHelpers", () => ({
  getSessionUser: async () => session.user,
  getSessionUserWriter: async () => session.user,
}));

const modules = import.meta.glob([
  "../**/*.{ts,js}",
  "!../__tests__/**",
  "!../convex/**",
]);

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const organizationId = await ctx.db.insert("organization", {
      name: "Ruang test",
      slug: "ruang-test",
      monthlyCredits: 0,
      createdAt: Date.now(),
    });
    const userId = await ctx.db.insert("user", {
      email: "owner@example.test",
      name: "Owner",
      emailVerified: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await ctx.db.insert("member", {
      organizationId,
      userId,
      role: "owner",
      createdAt: Date.now(),
    });
    return { organizationId, userId };
  });
  session.user = {
    _id: ids.userId,
    id: ids.userId,
    isAdmin: false,
    name: "Owner",
    activeOrganization: {
      id: ids.organizationId,
      role: "owner",
      name: "Ruang test",
      slug: "ruang-test",
    },
  };
  return { t, ...ids };
}

type F = Awaited<ReturnType<typeof fixture>>;

async function insertInvoice(
  f: F,
  over: Partial<{
    type: string;
    state: string;
    invoiceDate: number;
    totalAmount: number;
    archivedAt: number | undefined;
  }>,
) {
  await f.t.run(async (ctx) => {
    await ctx.db.insert("invoices", {
      number: "INV-1",
      type: "customer_invoice",
      state: "posted",
      invoiceDate: NOW,
      dueDate: NOW,
      subtotal: 0,
      totalAmount: 100,
      amountDue: 0,
      organizationId: f.organizationId,
      ownerId: f.userId,
      archivedAt: undefined,
      ...over,
    } as never);
  });
}

async function insertDeal(
  f: F,
  over: Partial<{
    title: string;
    stage: string;
    wonAt: number | undefined;
    lostAt: number | undefined;
    archivedAt: number | undefined;
  }>,
) {
  await f.t.run(async (ctx) => {
    await ctx.db.insert("deals", {
      title: "Deal",
      stage: "new",
      organizationId: f.organizationId,
      ownerId: f.userId,
      archivedAt: undefined,
      ...over,
    } as never);
  });
}

async function insertOrderWithLine(
  f: F,
  orderDate: number,
  qty: number,
  price: number,
  state = "confirmed",
) {
  return f.t.run(async (ctx) => {
    const saleOrderId = await ctx.db.insert("saleOrders", {
      number: "SO-1",
      state,
      orderDate,
      subtotal: qty * price,
      totalAmount: qty * price,
      organizationId: f.organizationId,
      ownerId: f.userId,
      archivedAt: undefined,
    } as never);
    await ctx.db.insert("saleOrderLines", {
      productName: "Widget",
      quantity: qty,
      unitPrice: price,
      subtotal: qty * price,
      organizationId: f.organizationId,
      saleOrderId,
    } as never);
    return saleOrderId as Id<"saleOrders">;
  });
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
});

afterEach(() => {
  vi.useRealTimers();
  session.user = null;
});

describe("monthlyComparison (real query)", () => {
  it("returns the full agreed shape with defaults for this_month", async () => {
    const f = await fixture();
    await insertInvoice(f, { invoiceDate: wib(2026, 3, 5), totalAmount: 300 });
    await insertInvoice(f, { invoiceDate: wib(2026, 2, 10), totalAmount: 400 });
    await insertDeal(f, { stage: "won", wonAt: wib(2026, 3, 6) });
    await insertDeal(f, { stage: "lost", lostAt: wib(2026, 3, 7) });
    await insertDeal(f, { stage: "won", wonAt: wib(2026, 2, 8) });

    const r = await f.t.query(api.analytics.monthlyComparison, {});

    expect(r.current).toMatchObject({
      dealsWon: 1,
      dealsLost: 1,
      winRate: 50,
      revenue: 300,
      newCompanies: 0,
    });
    expect(r.previous).toMatchObject({
      dealsCreated: 0,
      dealsWon: 1,
      dealsLost: 0,
      winRate: 100,
      revenue: 400,
      newCompanies: 0,
    });
    expect(r.change).toEqual({
      dealsCreated: 0,
      dealsWon: 0,
      revenue: -25,
      newCompanies: 0,
    });
    expect(r.period).toEqual({
      start: wib(2026, 3, 1),
      end: expect.any(Number),
      previousStart: wib(2026, 2, 1),
      previousEnd: expect.any(Number),
      label: expect.stringContaining("Mar 1, 2026"),
      comparisonLabel: expect.stringContaining("Feb 1, 2026"),
    });
    expect(r.period.end).toBeGreaterThanOrEqual(NOW);
    expect(r.period.end).toBeLessThan(NOW + 1000);
    expect(r.period.previousEnd).toBeGreaterThanOrEqual(
      wib(2026, 2, 15, 10) + 30 * 60_000,
    );
    expect(r.period.previousEnd).toBeLessThan(
      wib(2026, 2, 15, 10) + 30 * 60_000 + 1000,
    );
    expect(r.period.label).toContain("10:30");
  });

  it("rejects archived, cancelled, supplier and out-of-period invoices", async () => {
    const f = await fixture();
    await insertInvoice(f, { invoiceDate: wib(2026, 3, 5), totalAmount: 100 });
    await insertInvoice(f, {
      state: "cancel",
      invoiceDate: wib(2026, 3, 5),
      totalAmount: 900,
    });
    await insertInvoice(f, {
      archivedAt: wib(2026, 3, 6),
      invoiceDate: wib(2026, 3, 5),
      totalAmount: 900,
    });
    await insertInvoice(f, {
      type: "vendor_bill",
      invoiceDate: wib(2026, 3, 5),
      totalAmount: 900,
    });
    await insertInvoice(f, { invoiceDate: wib(2026, 2, 5), totalAmount: 900 });

    const r = await f.t.query(api.analytics.monthlyComparison, {
      range: "this_month",
    });
    expect(r.current.revenue).toBe(100);
    // The valid February invoice counts toward the previous period.
    expect(r.previous.revenue).toBe(900);
    expect(r.change.revenue).toBe(-89);
  });

  it("excludes archived deals and stage mismatches from wins and losses", async () => {
    const f = await fixture();
    await insertDeal(f, { stage: "won", wonAt: wib(2026, 3, 6) });
    await insertDeal(f, {
      stage: "won",
      wonAt: wib(2026, 3, 6),
      archivedAt: wib(2026, 3, 7),
    });
    await insertDeal(f, { stage: "new", wonAt: wib(2026, 3, 6) });
    await insertDeal(f, { stage: "lost", lostAt: wib(2026, 3, 6) });

    const r = await f.t.query(api.analytics.monthlyComparison, {});
    expect(r.current.dealsWon).toBe(1);
    expect(r.current.dealsLost).toBe(1);
    expect(r.current.winRate).toBe(50);
  });

  it("returns new instead of a fake 100 percent when the baseline is zero", async () => {
    const f = await fixture();
    await insertInvoice(f, { invoiceDate: wib(2026, 3, 5), totalAmount: 100 });
    const r = await f.t.query(api.analytics.monthlyComparison, {
      range: "this_month",
    });
    expect(r.change.revenue).toBeNull();
    expect(r.change.dealsWon).toBe(0);
  });

  it("winRate is null when no deals closed in the period", async () => {
    const f = await fixture();
    const r = await f.t.query(api.analytics.monthlyComparison, {});
    expect(r.current.winRate).toBeNull();
    expect(r.previous.winRate).toBeNull();
  });

  it("this_quarter compares Q1 with Q4 at the same elapsed position", async () => {
    const f = await fixture();
    await insertInvoice(f, { invoiceDate: wib(2026, 3, 5), totalAmount: 50 });
    // Dec 20 2025 falls after the elapsed cutoff (Dec 15, 10:30) and counts
    // toward neither period.
    await insertInvoice(f, { invoiceDate: wib(2025, 12, 20), totalAmount: 70 });
    await insertInvoice(f, {
      invoiceDate: wib(2025, 11, 20),
      totalAmount: 900,
    });

    const r = await f.t.query(api.analytics.monthlyComparison, {
      range: "this_quarter",
    });
    expect(r.period).toEqual({
      start: wib(2026, 1, 1),
      end: expect.any(Number),
      previousStart: wib(2025, 10, 1),
      previousEnd: expect.any(Number),
      label: expect.any(String),
      comparisonLabel: expect.any(String),
    });
    expect(r.period.end).toBeGreaterThanOrEqual(NOW);
    expect(r.period.end).toBeLessThan(NOW + 1000);
    // Same wall-clock position (Dec 15, 10:30 WIB), possibly ticked by 1 ms.
    expect(r.period.previousEnd).toBeGreaterThanOrEqual(
      wib(2025, 12, 15, 10) + 30 * 60_000,
    );
    expect(r.period.previousEnd).toBeLessThan(wib(2025, 12, 15, 11));
    expect(r.current.revenue).toBe(50);
    expect(r.previous.revenue).toBe(900);
  });
});

describe("organization scope and validation (real query)", () => {
  it("never includes another organization in period metrics, charts or products", async () => {
    const f = await fixture();
    const otherId = await f.t.run((ctx) =>
      ctx.db.insert("organization", {
        name: "Other team",
        slug: "other-team",
        createdAt: NOW,
        monthlyCredits: 0,
      }),
    );
    const other = { ...f, organizationId: otherId };
    await insertInvoice(other, {
      invoiceDate: wib(2026, 3, 5),
      totalAmount: 9000,
    });
    await insertDeal(other, { stage: "won", wonAt: wib(2026, 3, 5) });
    await insertOrderWithLine(other, wib(2026, 3, 5), 50, 100);
    const r = await f.t.query(api.analytics.monthlyComparison, {
      range: "this_month",
    });
    const chart = await f.t.query(api.analytics.revenueByMonth, {
      range: "this_month",
    });
    expect(r.current.revenue).toBe(0);
    expect(r.current.dealsWon).toBe(0);
    expect(chart.reduce((sum, bin) => sum + bin.revenue, 0)).toBe(0);
    expect(
      await f.t.query(api.analytics.topProducts, { range: "this_month" }),
    ).toEqual([]);
  });

  it("rejects invalid range values and signed-out queries", async () => {
    const f = await fixture();
    await expect(
      f.t.query(api.analytics.monthlyComparison, { range: "forever" as never }),
    ).rejects.toThrow();
    session.user = null;
    await expect(
      f.t.query(api.analytics.monthlyComparison, { range: "this_month" }),
    ).rejects.toThrow();
  });
});

describe("revenueByMonth (real query)", () => {
  it("buckets this_month by day and its revenue matches monthlyComparison", async () => {
    const f = await fixture();
    await insertInvoice(f, { invoiceDate: wib(2026, 3, 5), totalAmount: 300 });
    await insertInvoice(f, { invoiceDate: wib(2026, 2, 10), totalAmount: 400 });

    const chart = await f.t.query(api.analytics.revenueByMonth, {
      range: "this_month",
    });
    const comparison = await f.t.query(api.analytics.monthlyComparison, {
      range: "this_month",
    });

    expect(chart).toHaveLength(15); // Mar 1..Mar 15, last bucket partial
    expect(chart.reduce((s, b) => s + b.revenue, 0)).toBe(
      comparison.current.revenue,
    );
    expect(chart.reduce((s, b) => s + b.count, 0)).toBe(1);
    expect(chart[4]).toMatchObject({ revenue: 300, count: 1 });
  });

  it("last_month covers the whole previous month only", async () => {
    const f = await fixture();
    await insertInvoice(f, { invoiceDate: wib(2026, 2, 10), totalAmount: 400 });
    await insertInvoice(f, { invoiceDate: wib(2026, 1, 31), totalAmount: 900 });
    await insertInvoice(f, { invoiceDate: wib(2026, 3, 2), totalAmount: 900 });

    const chart = await f.t.query(api.analytics.revenueByMonth, {
      range: "last_month",
    });
    expect(chart).toHaveLength(28); // February 2026
    expect(chart.reduce((s, b) => s + b.revenue, 0)).toBe(400);
    const r = await f.t.query(api.analytics.monthlyComparison, {
      range: "last_month",
    });
    expect(r.current.revenue).toBe(400);
    expect(r.previous.revenue).toBe(900);
  });

  it("preserves the legacy 12-month shape when range is omitted", async () => {
    const f = await fixture();
    const months = await f.t.query(api.analytics.revenueByMonth, {});
    expect(months).toHaveLength(12);
    for (const m of months) {
      expect(m).toHaveProperty("month");
      expect(m).toHaveProperty("revenue");
      expect(m).toHaveProperty("count");
    }
  });
});

describe("topProducts (real query)", () => {
  it("filters by the orderDate schema field and keeps line aggregation", async () => {
    const f = await fixture();
    await insertOrderWithLine(f, wib(2026, 3, 5), 2, 100); // 200
    await insertOrderWithLine(f, wib(2026, 3, 6), 1, 50); // 50
    await insertOrderWithLine(f, wib(2026, 2, 10), 9, 900); // previous month: out
    await insertOrderWithLine(f, wib(2026, 3, 7), 5, 100, "cancel"); // cancelled

    const r = await f.t.query(api.analytics.topProducts, {
      range: "this_month",
    });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      productName: "Widget",
      totalQty: 3,
      totalRevenue: 250,
    });
  });
});
