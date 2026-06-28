## Context

The mobile dashboard (`apps/mobile/app/(app)/index.tsx`) is intentionally a **single-round-trip** screen: one call to `api.dashboard.mobileOverview` returns everything, deliberately avoiding the web dashboard's 8-query pattern. A prior P0 fix capped reads (per-stage open deals ≤500, overdue activities ≤200, overdue invoices ≤500, revenue-MTD invoices ≤1000) to stay under Convex function limits. Any new data must respect that contract.

The screen today is attention-first: overdue activities + overdue invoices, then two flat KPI tiles (Open deals, Revenue MTD), then an activity list. No chart library is installed on mobile — the stack is `nativewind` (tailwind-for-RN) + `react-native-reanimated`. Web uses `recharts` (DOM-only, not RN-compatible).

Relevant existing building blocks:
- `aggregateDealsByStage` (count/sum by stage) — already imported in `convex/dashboard.ts`.
- `monthStartOf`, `isRevenueInvoice` — pure helpers in `@crm/domain`.
- Web `analytics.revenueByMonth` already buckets invoices by month but pulls 2000 invoices over 12 months — too broad for the mobile contract.

## Goals / Non-Goals

**Goals:**
- Give the mobile dashboard two glanceable visuals: pipeline-by-stage distribution and a 6-month revenue sparkline.
- Keep the single-round-trip contract: all data still arrives via `mobileOverview`.
- Keep read budget bounded and documented.
- Zero new native dependencies.

**Non-Goals:**
- A general chart library. Two small visuals do not justify `react-native-gifted-charts` / `victory-native` / `react-native-skia`.
- Sales-performance table, top-products table, invoice-aging table on mobile home — those are web features; mobile users navigate to detail tabs.
- A date-range selector on mobile — MTD + last-6-months is the right default; the attention-first contract stays.
- Conversion funnel as a separate chart — the stacked pipeline bar already conveys stage distribution.
- Touching the web dashboard or its queries.

## Decisions

### D1. Pure nativewind `View` bars over a chart library
Two visuals, both one-row, both simple proportions. A stacked bar is `flex-row` with child `View`s whose `flex`/width % map to each stage's share. A sparkline is a `flex-row` of 6 thin `View`s whose heights map to revenue. This is ~40 LOC per component vs. pulling a chart lib (200KB+ on RN, skia binary, or gifted-charts JS bundle). Reanimated is already installed for an optional fade/scale entrance.

**Alternative considered:** `react-native-gifted-charts` — rejected: new dep, 6–9KB JS + D3-ish internals we don't need for two bars. `react-native-skia` — rejected: native binary weight, overkill for rectangles.

### D2. Extend `mobileOverview` rather than calling `analytics.*` from mobile
The mobile screen's whole design premise is one round trip. Calling `analytics.revenueByMonth` + `analytics.conversionFunnel` from the mobile client would re-introduce the multi-query pattern the screen was built to avoid, and those queries don't apply the mobile-specific read caps.

**Alternative considered:** New separate `mobileCharts` query — rejected: two round trips, two loading states, more wiring. One query already won.

### D3. 6-month sparkline window (not 12)
6 bars fit a phone row at ~12dp minimum width with readable month labels; 12 bars shrink below the ~8dp tap-target-friendly width and the trend at month-10 is low-signal for an attention-first screen. 6 months still shows a clear trend direction.

### D4. Pipeline bar shows all 5 stages including won/lost
Won and lost are part of the pipeline story (what closed, what churned). The mobile `mobileOverview` currently only fetches *open* stages. We add won + lost counts via `aggregateDealsByStage.countBatch` (already available), which is 2 index reads — cheap.

### D5. Taps deep-link, blocks are not interactive surfaces
Each visual block is a `Pressable` that navigates to `/deals` or `/invoices`. No tooltips, no per-segment press handlers (mobile users want to drill in, not inspect inline). Keeps the components stateless.

## Risks / Trade-offs

- **[Read-budget creep]** Adding a 6-month invoice query + 2 stage aggregates to `mobileOverview` raises total reads. → **Mitigation:** cap the 6-month invoice query at `REVENUE_6M_CAP = 500`, filter to revenue invoices client-side, bucket by month. Document caps in the same comment block as the existing P0 fix. Won/lost aggregates are 2 bounded index reads.
- **[Empty workspaces]** New visuals must degrade gracefully when there are zero deals or zero revenue, matching the existing `isWorkspaceEmpty` early-return. → **Mitigation:** components render a one-line muted "No pipeline data yet" / "No revenue yet" empty state, same pattern as the existing `EmptyState` usage.
- **[Stage color consistency]** Mobile stage colors must match web (`STAGE_CHART_COLORS` / `STAGE_BAR_COLORS` in `apps/web/src/lib/constants.ts`) to avoid two sources of truth. → **Mitigation:** add a shared `packages/domain/src/stage-colors.ts` (or reuse if it already exists) and import from both. Verify before duplicating.
- **[Sparkline scale edge case]** A single outlier month can flatten the other 5 bars to invisible. → **Mitigation:** bar height = `revenue / max(revenue) * MAX_BAR_HEIGHT`, with a `minHeight = 2dp` floor so zero-revenue months still show a visible tick. Label the max month implicitly via the highlighted current-month bar.
- **[Reanimated on low-end Android]** Entrance animation may jank on older devices. → **Mitigation:** animation is optional and gated behind `reanimated`'s `useReducedMotion`-style check; keep durations ≤200ms; fall back to static render if reduced motion is on.