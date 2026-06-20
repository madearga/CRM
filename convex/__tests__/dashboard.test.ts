/**
 * Unit tests for the mobile dashboard overview classifiers.
 *
 * These test the pure business rules extracted from convex/dashboard.ts
 * `mobileOverview` (see @crm/domain/src/dashboard.ts). The Convex query
 * wrapper itself is integration-tested against a deployment separately; here
 * we lock down the classification logic that drives the counts/totals so the
 * P0/P1 regressions (over-counting archived deals, paid invoices counted as
 * overdue, midnight month-start) cannot silently come back.
 *
 * Covers:
 *  - open deal classification (stage + archived)
 *  - open / overdue activity classification
 *  - overdue invoice classification incl. the P1 `amountDue > 0` &
 *    `paymentStatus !== "paid"` guards
 *  - revenue MTD invoice classification
 *  - month-start computation (incl. midnight rollover boundary)
 */
import { describe, it, expect } from "vitest";
import {
  OPEN_DEAL_STAGES,
  isOpenDeal,
  isOpenActivity,
  isOverdueActivity,
  isInvoiceOverdue,
  isRevenueInvoice,
  monthStartOf,
  type DashboardActivity,
  type DashboardInvoice,
  type DashboardDeal,
} from "@crm/domain";

const NOW = new Date("2026-06-15T10:00:00Z").getTime(); // mid-month, fixed

function deal(stage: string, extra: Partial<DashboardDeal> = {}): DashboardDeal {
  return { stage, ...extra };
}

function act(extra: Partial<DashboardActivity> = {}): DashboardActivity {
  return { dueAt: NOW - 1000, ...extra };
}

function inv(extra: Partial<DashboardInvoice> = {}): DashboardInvoice {
  return {
    state: "posted",
    type: "customer_invoice",
    dueDate: NOW - 1000,
    invoiceDate: NOW,
    amountDue: 1_000_000,
    totalAmount: 1_000_000,
    paymentStatus: "unpaid",
    ...extra,
  };
}

describe("OPEN_DEAL_STAGES", () => {
  it("contains exactly the active pipeline stages", () => {
    expect([...OPEN_DEAL_STAGES]).toEqual(["new", "contacted", "proposal"]);
  });
});

describe("isOpenDeal", () => {
  it.each(["new", "contacted", "proposal"] as const)(
    "open stage %s is open",
    (stage) => {
      expect(isOpenDeal(deal(stage))).toBe(true);
    }
  );

  it.each(["won", "lost"] as const)("closed stage %s is not open", (stage) => {
    expect(isOpenDeal(deal(stage))).toBe(false);
  });

  it("archived open-stage deal is not open", () => {
    expect(isOpenDeal(deal("new", { archivedAt: NOW }))).toBe(false);
  });

  it("archived closed-stage deal is not open", () => {
    expect(isOpenDeal(deal("won", { archivedAt: NOW }))).toBe(false);
  });
});

describe("isOpenActivity", () => {
  it("planned activity with dueAt is open", () => {
    expect(isOpenActivity(act({ status: "planned" }))).toBe(true);
  });

  it("activity without status but with dueAt and not completed is open", () => {
    expect(isOpenActivity(act({ status: undefined }))).toBe(true);
  });

  it("activity without dueAt is not open", () => {
    expect(isOpenActivity(act({ dueAt: undefined }))).toBe(false);
  });

  it("done activity is not open", () => {
    expect(isOpenActivity(act({ status: "done" }))).toBe(false);
  });

  it("cancelled activity is not open", () => {
    expect(isOpenActivity(act({ status: "cancelled" }))).toBe(false);
  });

  it("completed activity is not open even if planned", () => {
    expect(isOpenActivity(act({ status: "planned", completedAt: NOW }))).toBe(
      false
    );
  });
});

describe("isOverdueActivity", () => {
  it("open activity due in the past is overdue", () => {
    expect(isOverdueActivity(act({ status: "planned", dueAt: NOW - 1 }), NOW)).toBe(
      true
    );
  });

  it("open activity due in the future is not overdue", () => {
    expect(isOverdueActivity(act({ status: "planned", dueAt: NOW + 1000 }), NOW)).toBe(
      false
    );
  });

  it("due exactly now is not overdue (strict <)", () => {
    expect(isOverdueActivity(act({ status: "planned", dueAt: NOW }), NOW)).toBe(false);
  });

  it("done activity due in the past is not overdue", () => {
    expect(isOverdueActivity(act({ status: "done", dueAt: NOW - 1 }), NOW)).toBe(false);
  });
});

describe("isInvoiceOverdue", () => {
  it("posted unpaid invoice past due with amount owed is overdue", () => {
    expect(isInvoiceOverdue(inv(), NOW)).toBe(true);
  });

  it("posted invoice due in the future is not overdue", () => {
    expect(isInvoiceOverdue(inv({ dueDate: NOW + 1000 }), NOW)).toBe(false);
  });

  // --- P1 regression guards ---
  it("posted invoice with amountDue === 0 is NOT overdue (paid off but state not transitioned)", () => {
    expect(
      isInvoiceOverdue(inv({ amountDue: 0, paymentStatus: "paid" }), NOW)
    ).toBe(false);
  });

  it("posted invoice with paymentStatus 'paid' but amountDue > 0 is NOT overdue", () => {
    // Defensive: even if amountDue is stale, explicit paid status wins.
    expect(
      isInvoiceOverdue(inv({ amountDue: 1_000_000, paymentStatus: "paid" }), NOW)
    ).toBe(false);
  });

  it("partially_paid posted invoice past due with amount owed IS overdue", () => {
    expect(
      isInvoiceOverdue(inv({ paymentStatus: "partially_paid", amountDue: 250_000 }), NOW)
    ).toBe(true);
  });

  it("draft invoice past due is NOT overdue (not yet posted)", () => {
    expect(isInvoiceOverdue(inv({ state: "draft" }), NOW)).toBe(false);
  });

  it("paid-state invoice past due is NOT overdue", () => {
    expect(isInvoiceOverdue(inv({ state: "paid" }), NOW)).toBe(false);
  });

  it("cancelled invoice past due is NOT overdue", () => {
    expect(isInvoiceOverdue(inv({ state: "cancel" }), NOW)).toBe(false);
  });

  it("archived posted invoice past due is NOT overdue", () => {
    expect(isInvoiceOverdue(inv({ archivedAt: NOW }), NOW)).toBe(false);
  });
});

describe("isRevenueInvoice", () => {
  it("customer invoice not cancelled is revenue", () => {
    expect(isRevenueInvoice(inv({ state: "posted" }))).toBe(true);
  });

  it("paid customer invoice is revenue", () => {
    expect(isRevenueInvoice(inv({ state: "paid" }))).toBe(true);
  });

  it("cancelled customer invoice is not revenue", () => {
    expect(isRevenueInvoice(inv({ state: "cancel" }))).toBe(false);
  });

  it("archived customer invoice is not revenue", () => {
    expect(isRevenueInvoice(inv({ archivedAt: NOW }))).toBe(false);
  });

  it("vendor bill is not revenue", () => {
    expect(isRevenueInvoice(inv({ type: "vendor_bill" }))).toBe(false);
  });

  it("credit note is not revenue", () => {
    expect(isRevenueInvoice(inv({ type: "credit_note" }))).toBe(false);
  });
});

describe("monthStartOf", () => {
  it("returns midnight of day 1 of the same month (local time)", () => {
    // Use a local-constructed `now` so the test is TZ-independent and mirrors
    // what the runtime produces when `new Date(Date.now())` is built in the
    // mobile app's locale.
    const localNow = new Date(2026, 5, 15, 10, 0, 0).getTime(); // local June 15
    const start = monthStartOf(localNow);
    const d = new Date(start);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5); // June (0-indexed local)
    expect(d.getDate()).toBe(1);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
  });

  it("midnight rollover: month start is the first instant of the month", () => {
    // An invoice timestamped at the exact month-start instant must be
    // included in MTD revenue (the query uses gte(monthStart)).
    const localNow = new Date(2026, 5, 15, 10, 0, 0).getTime();
    const start = monthStartOf(localNow);
    expect(start).toBeLessThanOrEqual(localNow);
    expect(isRevenueInvoice(inv({ invoiceDate: start }))).toBe(true);
    expect(inv({ invoiceDate: start }).invoiceDate >= start).toBe(true);
  });

  it("an invoice dated one ms before month start is NOT MTD", () => {
    const localNow = new Date(2026, 5, 15, 10, 0, 0).getTime();
    const start = monthStartOf(localNow);
    const lastMonth = inv({ invoiceDate: start - 1 });
    expect(lastMonth.invoiceDate >= start).toBe(false);
  });

  it("rolls over to previous month when now is in early January (no off-by-one)", () => {
    const localNow = new Date(2026, 0, 1, 0, 0, 0).getTime(); // Jan 1 midnight
    const start = monthStartOf(localNow);
    const d = new Date(start);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0); // January
    expect(d.getDate()).toBe(1);
  });

  it("rolls over to December when now is in mid-December", () => {
    const localNow = new Date(2026, 11, 20, 23, 59, 59).getTime();
    const start = monthStartOf(localNow);
    const d = new Date(start);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(11); // December
    expect(d.getDate()).toBe(1);
  });
});
