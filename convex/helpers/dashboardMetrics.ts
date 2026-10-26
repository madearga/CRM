// Centralized period and aggregation semantics for dashboard metrics.
// All calendar periods are Asia/Jakarta (WIB), a fixed UTC+7 offset.
// A timestamp belongs to a period when start <= t < end.
import { z } from "zod";

export const DASHBOARD_RANGES = [
  "this_month",
  "last_month",
  "this_quarter",
  "this_year",
] as const;
export const dashboardRangeSchema = z.enum(DASHBOARD_RANGES);
export type DashboardRange = (typeof DASHBOARD_RANGES)[number];

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

/** Wall-clock parts of a timestamp in WIB. */
export function wibParts(ms: number) {
  const d = new Date(ms + WIB_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(), // 0-based
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
    ms: d.getUTCMilliseconds(),
  };
}

/** Convert WIB wall-clock parts to a UTC timestamp. */
function wibMs(year: number, month: number, day: number, hour = 0) {
  return Date.UTC(year, month, day, hour) - WIB_OFFSET_MS;
}

/** WIB midnight at the first day of the WIB month containing ms. */
export function wibMonthStart(ms: number) {
  const p = wibParts(ms);
  return wibMs(p.year, p.month, 1);
}

/** WIB midnight at the first day of the WIB quarter containing ms. */
export function wibQuarterStart(ms: number) {
  const p = wibParts(ms);
  return wibMs(p.year, Math.floor(p.month / 3) * 3, 1);
}

/** WIB midnight at Jan 1 of the WIB year containing ms. */
export function wibYearStart(ms: number) {
  const p = wibParts(ms);
  return wibMs(p.year, 0, 1);
}

function addMonths(ms: number, delta: number) {
  const p = wibParts(ms);
  // Date.UTC normalizes month overflow and clamps the day to the natural
  // month end (leap years included) because day 1 never overflows.
  return wibMs(p.year, p.month + delta, 1);
}

export type Period = { start: number; end: number };

export type ComparisonPeriods = {
  current: Period;
  previous: Period;
  label: string;
  comparisonLabel: string;
};

function fmtDayTime(ms: number) {
  return new Date(ms + WIB_OFFSET_MS).toLocaleString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

function fmtDay(ms: number) {
  return new Date(ms + WIB_OFFSET_MS).toLocaleString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Human label for a period: dates and times for partial periods. */
function fmtPeriod(period: Period, partial: boolean) {
  return partial
    ? `${fmtDay(period.start)} ${fmtDayTime(period.start).slice(-5)} – ${fmtDayTime(period.end)} WIB`
    : `${fmtDay(period.start)} – ${fmtDay(period.end - 1)} WIB`;
}

function fmtMonth(ms: number) {
  return new Date(ms + WIB_OFFSET_MS).toLocaleString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
  });
}

/**
 * Resolve the current and preceding periods for a range.
 *
 * The current period runs from its calendar start to now (end exclusive,
 * so a timestamp exactly at now is not included). The previous period is
 * the preceding calendar period (month, quarter, or year) cut at the same
 * elapsed position, clamped to that period's natural end (short months and
 * leap years included).
 *
 * - this_month: Oct 26 14:23 -> Sep 1 00:00 - Sep 26 14:23.
 * - last_month: the full preceding month versus the month before it.
 * - this_quarter: Q4 (from Oct 1) -> Q3 (from Jul 1) at the same position.
 * - this_year: this year (from Jan 1) -> last year at the same position.
 */
export function resolveComparisonPeriods(
  now: number,
  range: DashboardRange,
): ComparisonPeriods {
  if (range === "last_month") {
    const curStart = addMonths(wibMonthStart(now), -1);
    const prevStart = addMonths(curStart, -1);
    return {
      current: { start: curStart, end: wibMonthStart(now) },
      previous: { start: prevStart, end: curStart },
      label: fmtPeriod({ start: curStart, end: wibMonthStart(now) }, false),
      comparisonLabel: fmtPeriod({ start: prevStart, end: curStart }, false),
    };
  }

  const monthsBack =
    range === "this_month" ? 1 : range === "this_quarter" ? 3 : 12;
  const start =
    range === "this_month"
      ? wibMonthStart(now)
      : range === "this_quarter"
        ? wibQuarterStart(now)
        : wibYearStart(now);

  const prevStart = addMonths(start, -monthsBack);
  // Wall-clock month offset of NOW (not of the period start), keeping the
  // date and time of day, so unequal month and quarter lengths never shift
  // dates. Clamped to the target month's natural end and to the current
  // period start.
  const p = wibParts(now);
  const midnight = wibMs(p.year, p.month, p.day);
  const targetMonthStart = addMonths(midnight, -monthsBack);
  const candidate = targetMonthStart + (p.day - 1) * DAY_MS + (now - midnight);
  const targetMonthEnd = addMonths(targetMonthStart, 1);
  const prevEnd = Math.min(candidate, targetMonthEnd, start);

  return {
    current: { start, end: now },
    previous: { start: prevStart, end: prevEnd },
    label: fmtPeriod({ start, end: now }, true),
    comparisonLabel: fmtPeriod({ start: prevStart, end: prevEnd }, true),
  };
}

/**
 * Percent change from previous to current.
 * Returns null when previous is 0 and current is above 0 (the frontend shows
 * "new"); returns 0 when both are 0.
 */
export function percentDelta(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? null : 0;
  return Math.round(((current - previous) / previous) * 100);
}

/** Win rate in whole percent from closed deals, null when nothing closed. */
export function winRate(wins: number, losses: number): number | null {
  const closed = wins + losses;
  if (closed === 0) return null;
  return Math.round((wins / closed) * 100);
}

/**
 * Time buckets covering a period: calendar days (WIB) for month ranges,
 * calendar months for quarter and year ranges. The last bucket of a
 * "this_*" range is partial and ends at the period end.
 */
export function bucketsForPeriod(
  period: Period,
  range: DashboardRange,
): Array<Period & { label: string }> {
  const buckets: Array<Period & { label: string }> = [];
  if (range === "this_month" || range === "last_month") {
    // Calendar days (WIB midnights) for month ranges.
    let cursor = wibMonthStart(period.start);
    while (cursor < period.end) {
      const p = wibParts(cursor);
      const next = wibMs(p.year, p.month, p.day + 1);
      buckets.push({
        start: cursor,
        end: Math.min(next, period.end),
        label: new Date(cursor + WIB_OFFSET_MS).toLocaleString("en-US", {
          timeZone: "UTC",
          month: "short",
          day: "numeric",
        }),
      });
      cursor = next;
    }
    return buckets;
  }

  let cursor = wibMonthStart(period.start);
  while (cursor < period.end) {
    const next = addMonths(cursor, 1);
    buckets.push({
      start: cursor,
      end: Math.min(next, period.end),
      label: fmtMonth(cursor),
    });
    cursor = next;
  }
  return buckets;
}

// ---------------------------------------------------------------------------
// Aggregation rules shared by the dashboard queries
// ---------------------------------------------------------------------------

export type InvoiceLike = {
  type: string;
  state: string;
  archivedAt?: number | null;
  invoiceDate: number;
  totalAmount?: number | null;
};

/** Customer invoices that count toward revenue, filtered to a period. */
export function revenueInvoicesInPeriod<T extends InvoiceLike>(
  invoices: T[],
  period: Period,
): T[] {
  return invoices.filter(
    (inv) =>
      inv.type === "customer_invoice" &&
      inv.state !== "cancel" &&
      inv.archivedAt == null &&
      inv.invoiceDate >= period.start &&
      inv.invoiceDate < period.end,
  );
}

export function sumRevenue(invoices: InvoiceLike[]): number {
  return invoices.reduce((sum, inv) => sum + (inv.totalAmount ?? 0), 0);
}

export type DealLike = {
  stage: string;
  archivedAt?: number | null;
  wonAt?: number | null;
  lostAt?: number | null;
};

/** Non-archived won deals closed in the period. */
export function wonDealsInPeriod<T extends DealLike>(
  deals: T[],
  period: Period,
): T[] {
  return deals.filter(
    (d) =>
      d.stage === "won" &&
      d.archivedAt == null &&
      d.wonAt != null &&
      d.wonAt >= period.start &&
      d.wonAt < period.end,
  );
}

/** Non-archived lost deals closed in the period. */
export function lostDealsInPeriod<T extends DealLike>(
  deals: T[],
  period: Period,
): T[] {
  return deals.filter(
    (d) =>
      d.stage === "lost" &&
      d.archivedAt == null &&
      d.lostAt != null &&
      d.lostAt >= period.start &&
      d.lostAt < period.end,
  );
}

export type SaleOrderLike = {
  state: string;
  archivedAt?: number | null;
  orderDate: number;
};

/** Sale orders that count toward top products, filtered to a period. */
export function saleOrdersInPeriod<T extends SaleOrderLike>(
  orders: T[],
  period: Period,
): T[] {
  return orders.filter(
    (so) =>
      so.state !== "cancel" &&
      so.archivedAt == null &&
      so.orderDate >= period.start &&
      so.orderDate < period.end,
  );
}
