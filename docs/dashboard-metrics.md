# Dashboard metrics

## Scope

The dashboard keeps its existing Convex adapter and layout. The period filter changes invoice value, won deals, closed-deal win rate, and Top Products. Pipeline, outstanding/overdue invoices, activities, and agent pipeline widgets remain current snapshots. Sales Performance remains an all-time view; its won/total-deals ratio is not the period's closed-deal win rate.

## Module and seam

`convex/helpers/dashboardMetrics.ts` owns calendar periods, comparison periods, invoice inclusion, closed-deal inclusion, and chart buckets. The existing queries in `convex/analytics.ts` remain the authenticated interface. They derive the organization from the session, load its records, and use those shared rules. The page sends its selected range, renders the returned figures and period labels, and does not calculate win rate.

This concentrates semantic changes in one module (locality), with leverage across 3 query callers. It does not introduce a new adapter or a combined dashboard query.

## Calendar rules

- All calendar arithmetic uses WIB (`Asia/Jakarta`, UTC+7), independent of the host time zone.
- `this_month`, `this_quarter`, and `this_year` begin at their calendar start and end at the query's current time.
- The comparison starts at the preceding calendar period's start and ends at the equivalent calendar date and time. For example, October 26 compares with September 26, and December 26 in Q4 compares with September 26 in Q3.
- When that date does not exist, clamp to the target month's end. Never let the comparison spill beyond its natural period.
- `last_month` uses a completed month and the full month before it.
- Intervals include the start and exclude the end.
- Month charts use daily buckets; quarter/year charts use monthly buckets. The last bucket may be partial.

## Metric meaning

See `GLOSSARY.md`. Invoice value retains the former revenue inclusion rule; it is not received cash. Win rate is wins / (wins + losses) for non-archived deals closed in the period; no closed deals yields `null`, shown as a dash. Missing/loading/error results must not appear as genuine zero figures.

A change from zero to a positive value has no finite percentage baseline: return `null` and show “Baru”. Two zero values produce a neutral 0%.

Top Products keeps its sales-order-line meaning, filtered by the sales order's `orderDate`. It is not an invoice-revenue reconciliation.

## Verification surfaces

- `convex/_tests/dashboardPeriodContract.test.ts`: independent calendar examples, unequal quarter lengths, leap years, WIB rollover, and daily buckets.
- Backend dashboard metric tests: authenticated queries and organization-scoped records, invoice/order exclusions, selected-period results, zero baseline and chart/KPI reconciliation.
- `apps/web/src/__tests__/dashboard-period.test.tsx`: rendered-page range propagation, unchanged snapshot arguments, closed-deal win rate, and loading/error/empty values.

The rendered-page tests mock the adapter; they complement, not replace, real query tests. No production deployment or performance guarantee is implied by these checks.
