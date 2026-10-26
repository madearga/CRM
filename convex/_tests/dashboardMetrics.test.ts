// Unit tests for the dashboard period and aggregation semantics in
// convex/helpers/dashboardMetrics.ts. All expectations are stated in WIB
// (fixed UTC+7), so they do not depend on the machine time zone.
import { describe, it, expect } from "vitest";

import {
  bucketsForPeriod,
  lostDealsInPeriod,
  percentDelta,
  resolveComparisonPeriods,
  revenueInvoicesInPeriod,
  saleOrdersInPeriod,
  winRate,
  wonDealsInPeriod,
} from "../helpers/dashboardMetrics";

// 2026-03-15 10:30 WIB = 2026-03-15T03:30Z. 2026 is not a leap year.
const NOW = Date.UTC(2026, 2, 15, 3, 30);
// 2024 is a leap year.
const LEAP_NOW = Date.UTC(2024, 2, 31, 9, 0); // Mar 31, 2024 16:00 WIB

const wib = (y: number, m: number, d: number, h = 0) =>
  Date.UTC(y, m - 1, d, h) - 7 * 3600_000;

describe("resolveComparisonPeriods", () => {
  it("this_month: current from WIB month start to now, end exclusive at now", () => {
    const { current } = resolveComparisonPeriods(NOW, "this_month");
    expect(current.start).toBe(wib(2026, 3, 1));
    expect(current.end).toBe(NOW);
  });

  it("this_month: previous is prior calendar month at the same elapsed position", () => {
    const { previous, label, comparisonLabel } = resolveComparisonPeriods(
      NOW,
      "this_month",
    );
    // Elapsed since Mar 1 is 14 days 10.5 hours.
    expect(previous.start).toBe(wib(2026, 2, 1));
    expect(previous.end).toBe(wib(2026, 2, 15, 10) + 30 * 60_000);
    expect(label).toContain("Mar 1, 2026");
    expect(label).toContain("10:30");
    expect(comparisonLabel).toContain("Feb 15, 2026");
    expect(comparisonLabel).toContain("10:30");
  });

  it("this_month: clamps the previous end at the natural month end", () => {
    // Mar 31 -> previous position would be Feb 31, clamped to Mar 1.
    const now = Date.UTC(2026, 2, 31, 9, 0); // Mar 31, 16:00 WIB
    const { previous } = resolveComparisonPeriods(now, "this_month");
    expect(previous.start).toBe(wib(2026, 2, 1));
    expect(previous.end).toBe(wib(2026, 3, 1));
  });

  it("this_month: handles leap years (Mar 30, 2024 -> Feb 29, 2024)", () => {
    const now = Date.UTC(2024, 2, 30, 9, 0); // Mar 30, 2024 16:00 WIB
    const { previous } = resolveComparisonPeriods(now, "this_month");
    // Feb 30 does not exist, so the previous end clamps to the boundary:
    // Mar 1, 2024 00:00 WIB (= Feb 29, 17:00 UTC).
    expect(previous.end).toBe(Date.UTC(2024, 2, 1) - 7 * 3600_000);
  });

  it("this_quarter: previous is the prior quarter at the same elapsed position", () => {
    const { current, previous } = resolveComparisonPeriods(NOW, "this_quarter");
    expect(current.start).toBe(wib(2026, 1, 1));
    expect(previous.start).toBe(wib(2025, 10, 1));
    // Same calendar date (Dec 15) and time of day, not a millisecond shift.
    expect(previous.end).toBe(wib(2025, 12, 15, 10) + 30 * 60_000);
  });

  it("this_year: previous is last year at the same elapsed position", () => {
    const { current, previous } = resolveComparisonPeriods(NOW, "this_year");
    expect(current.start).toBe(wib(2026, 1, 1));
    expect(previous.start).toBe(wib(2025, 1, 1));
    expect(previous.end).toBe(wib(2025, 3, 15, 10) + 30 * 60_000);
  });

  it("this_quarter: keeps calendar dates across quarter lengths", () => {
    // Q1 2024, Mar 31 16:00: previous is Q4 2023, same date and time.
    const { previous } = resolveComparisonPeriods(LEAP_NOW, "this_quarter");
    expect(previous.start).toBe(wib(2023, 10, 1));
    expect(previous.end).toBe(wib(2023, 12, 31, 16));
  });

  it("last_month: two full calendar months", () => {
    const { current, previous, label, comparisonLabel } =
      resolveComparisonPeriods(NOW, "last_month");
    expect(current).toEqual({ start: wib(2026, 2, 1), end: wib(2026, 3, 1) });
    expect(previous).toEqual({ start: wib(2026, 1, 1), end: wib(2026, 2, 1) });
    expect(label).toContain("Feb");
    expect(comparisonLabel).toContain("Jan");
  });

  it("equality cutoff: a timestamp exactly at now is outside the period", () => {
    const { current } = resolveComparisonPeriods(NOW, "this_month");
    expect(NOW >= current.start && NOW < current.end).toBe(false);
  });
});

describe("percentDelta", () => {
  it("null when previous is 0 and current is above 0", () => {
    expect(percentDelta(5, 0)).toBeNull();
  });
  it("0 when both are 0", () => {
    expect(percentDelta(0, 0)).toBe(0);
  });
  it("rounds the percent change", () => {
    expect(percentDelta(150, 100)).toBe(50);
    expect(percentDelta(50, 100)).toBe(-50);
    expect(percentDelta(1, 3)).toBe(-67);
  });
  it("0 when current is 0 and previous is 0 only; decline when prior exists", () => {
    expect(percentDelta(0, 10)).toBe(-100);
  });
});

describe("winRate", () => {
  it("null with no closed deals", () => {
    expect(winRate(0, 0)).toBeNull();
  });
  it("wins over closed deals, rounded", () => {
    expect(winRate(3, 1)).toBe(75);
    expect(winRate(1, 2)).toBe(33);
  });
});

describe("bucketsForPeriod", () => {
  it("daily buckets for month ranges, from WIB midnight", () => {
    const buckets = bucketsForPeriod(
      { start: wib(2026, 3, 1), end: NOW },
      "this_month",
    );
    expect(buckets).toHaveLength(15); // Mar 1..Mar 15, last is partial
    expect(buckets[0].start).toBe(wib(2026, 3, 1));
    expect(buckets[14].end).toBe(NOW);
  });

  it("full month range gives whole days", () => {
    const buckets = bucketsForPeriod(
      { start: wib(2026, 2, 1), end: wib(2026, 3, 1) },
      "last_month",
    );
    expect(buckets).toHaveLength(28);
  });

  it("monthly buckets for quarter and year ranges", () => {
    const q = bucketsForPeriod(
      { start: wib(2026, 1, 1), end: NOW },
      "this_quarter",
    );
    expect(q.map((b) => b.label)).toEqual(["Jan 2026", "Feb 2026", "Mar 2026"]);
    expect(q[2].end).toBe(NOW);
    const y = bucketsForPeriod(
      { start: wib(2026, 1, 1), end: NOW },
      "this_year",
    );
    expect(y).toHaveLength(3);
  });
});

describe("aggregation filters", () => {
  const invoice = (over: object) => ({
    type: "customer_invoice",
    state: "posted",
    invoiceDate: NOW - 1000,
    totalAmount: 100,
    archivedAt: undefined,
    ...over,
  });

  it("keeps only customer, non-cancel, non-archived invoices in the period", () => {
    const invoices = [
      invoice({}),
      invoice({ type: "vendor_bill" }),
      invoice({ state: "cancel" }),
      invoice({ archivedAt: NOW - 500 }),
      invoice({ invoiceDate: NOW - 10_000_000 }),
      invoice({ invoiceDate: NOW }), // exactly at end: excluded
    ];
    expect(
      revenueInvoicesInPeriod(invoices, { start: NOW - 5000, end: NOW }),
    ).toHaveLength(1);
  });

  it("won/lost deals match stage, timestamp and non-archived", () => {
    const deal = (over: object) => ({
      stage: "won",
      wonAt: NOW - 1000,
      lostAt: undefined,
      archivedAt: undefined,
      ...over,
    });
    const deals = [
      deal({}),
      deal({ stage: "lost", lostAt: NOW - 1000, wonAt: undefined }),
      deal({ archivedAt: 1 }),
      deal({ wonAt: NOW - 10_000_000 }),
      deal({ wonAt: NOW }), // excluded at boundary
    ];
    const period = { start: NOW - 5000, end: NOW };
    expect(wonDealsInPeriod(deals, period)).toHaveLength(1);
    expect(lostDealsInPeriod(deals, period)).toHaveLength(1);
  });

  it("sale orders use orderDate and exclude cancelled and archived", () => {
    const order = (over: object) => ({
      state: "confirmed",
      orderDate: NOW - 1000,
      archivedAt: undefined,
      ...over,
    });
    const orders = [
      order({}),
      order({ state: "cancel" }),
      order({ archivedAt: 1 }),
      order({ orderDate: NOW - 10_000_000 }),
      order({ orderDate: NOW }),
    ];
    expect(
      saleOrdersInPeriod(orders, { start: NOW - 5000, end: NOW }),
    ).toHaveLength(1);
  });
});
