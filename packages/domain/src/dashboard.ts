// Pure business-logic helpers for the mobile dashboard overview query.
//
// These classifiers are extracted from convex/dashboard.ts so they can be
// unit-tested without a running Convex deployment (see convex/__tests__/dashboard.test.ts).
// They take minimal structural shapes — only the fields each rule needs — so they
// stay decoupled from the full Convex document types.
//
// No Convex imports here: safe to import from vitest directly.

// NOTE: intentionally does NOT import from "./index" to avoid a circular
// module dependency (index.ts re-exports this file). The open-stage list is
// duplicated here as a leaf constant; keep it in sync with ACTIVE_STAGES.

/** Activity lifecycle status (mirrors schema `activities.status`). */
export type ActivityStatus = "planned" | "done" | "cancelled";

/** Invoice state (mirrors schema `invoices.state`). */
export type InvoiceState = "draft" | "posted" | "paid" | "cancel";

/** Invoice type (mirrors schema `invoices.type`). */
export type InvoiceType = "customer_invoice" | "vendor_bill" | "credit_note";

/** Invoice payment status (mirrors schema `invoices.paymentStatus`). */
export type InvoicePaymentStatus = "unpaid" | "partially_paid" | "paid";

/** Minimal activity shape needed by the dashboard classifiers. */
export interface DashboardActivity {
  /** Scheduled due time. Absent ⇒ activity has no schedule / not actionable. */
  dueAt?: number;
  /** Set when the activity was completed. */
  completedAt?: number;
  /** Lifecycle status. */
  status?: ActivityStatus;
}

/** Minimal invoice shape needed by the dashboard classifiers. */
export interface DashboardInvoice {
  state: InvoiceState;
  type: InvoiceType;
  dueDate: number;
  invoiceDate: number;
  amountDue: number;
  totalAmount: number;
  paymentStatus?: InvoicePaymentStatus;
  archivedAt?: number;
}

/** Minimal deal shape needed by the dashboard classifiers. */
export interface DashboardDeal {
  stage: string;
  archivedAt?: number;
}

/**
 * Stages that count toward the "open pipeline".
 * Open = active deal still being worked (not won, not lost).
 * Mirrors `ACTIVE_STAGES` in index.ts.
 */
export const OPEN_DEAL_STAGES = ["new", "contacted", "proposal"] as const;
export type OpenDealStage = (typeof OPEN_DEAL_STAGES)[number];

/** True if the deal is in an open stage and not archived. */
export function isOpenDeal(deal: DashboardDeal): boolean {
  return !deal.archivedAt && OPEN_DEAL_STAGES.includes(deal.stage as OpenDealStage);
}

/**
 * True if the activity is still actionable: has a due time, is not completed,
 * and is not in a terminal status (`done` / `cancelled`).
 */
export function isOpenActivity(activity: DashboardActivity): boolean {
  return (
    activity.dueAt !== undefined &&
    activity.completedAt === undefined &&
    activity.status !== "done" &&
    activity.status !== "cancelled"
  );
}

/** True if the activity is open AND past its due time. */
export function isOverdueActivity(activity: DashboardActivity, now: number): boolean {
  return isOpenActivity(activity) && (activity.dueAt ?? Infinity) < now;
}

/**
 * True if an invoice is overdue: posted, unarchived, past its due date, AND
 * still owes money.
 *
 * Requires `amountDue > 0` and `paymentStatus !== "paid"` so that fully-paid
 * invoices which remain in the `posted` state (state was not transitioned to
 * `paid` after the final payment) are NOT counted as overdue. Counting those
 * was a P1 bug that inflated the overdue total and list.
 */
export function isInvoiceOverdue(invoice: DashboardInvoice, now: number): boolean {
  return (
    invoice.state === "posted" &&
    !invoice.archivedAt &&
    invoice.dueDate < now &&
    invoice.amountDue > 0 &&
    invoice.paymentStatus !== "paid"
  );
}

/**
 * True if an invoice counts toward month-to-date revenue: a customer invoice
 * that is not cancelled and not archived.
 */
export function isRevenueInvoice(invoice: DashboardInvoice): boolean {
  return (
    invoice.type === "customer_invoice" &&
    invoice.state !== "cancel" &&
    !invoice.archivedAt
  );
}

/** Start of the current calendar month (ms epoch) for a given `now`. */
export function monthStartOf(now: number): number {
  const d = new Date(now);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
