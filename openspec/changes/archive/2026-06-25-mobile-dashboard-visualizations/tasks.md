## 1. Backend — extend `mobileOverview`

- [x] 1.1 Add `dealsByStage: { stage, count, value }[]` to `mobileOverview` returns schema (all 5 stages, including won/lost). Won/lost counts via `aggregateDealsByStage.countBatch`; values via `sumBatch`. Reuse the per-stage open-deal queries already in the handler for new/contacted/proposal.
- [x] 1.2 Add `revenueByMonth: { month, revenue }[]` (last 6 calendar months, oldest→newest) to `mobileOverview` returns. One indexed query `invoices.organizationId_invoiceDate` gte 6 months ago, capped at `REVENUE_6M_CAP = 500`, filtered to revenue invoices (`isRevenueInvoice`), bucketed by calendar month. Zero-revenue months still emit `{ month, revenue: 0 }` so the client can distinguish "no data" from "zero".
- [x] 1.3 Document the two new caps (`REVENUE_6M_CAP`) and the won/lost aggregate reads in the existing P0 read-budget comment block in `convex/dashboard.ts`.
- [x] 1.4 Update `convex/__tests__/dashboard.test.ts` (and `dashboardStructure.test.ts` if it asserts the return shape) for the two new fields — happy path with data, empty workspace (all-zero series), and unauthorized throw unchanged.

## 2. Shared stage colors

- [x] 2.1 Verify whether a shared stage-color module already exists. If `apps/web/src/lib/constants.ts` is the only source, extract `STAGE_CHART_COLORS` and `STAGE_BAR_COLORS` into a shared module under `packages/domain/src/stage-colors.ts` (or extend an existing domain constants file) and re-export from the web constants to preserve the existing import path.
- [x] 2.2 Export the shared stage-color map from `@crm/domain` so mobile can import it.

## 3. Mobile — presentational components

- [x] 3.1 Create `apps/mobile/src/components/pipeline-bar.tsx`: a `Pressable` wrapping a horizontal proportional stacked bar (5 `View` segments, widths = `count / totalDeals * 100%`, colored via shared stage-color map) + a chip row beneath (5 cells: stage name, count, formatted-currency value). Props: `dealsByStage`, `onPress`. Empty state: muted "No pipeline data yet". Unknown stage falls back to primary color.
- [x] 3.2 Create `apps/mobile/src/components/revenue-sparkline.tsx`: a `Pressable` wrapping a `flex-row` of up to 6 mini-bars (height = `revenue / max * MAX_BAR_HEIGHT`, `minHeight = 2dp`, current/last month highlighted) with the existing MTD figure as headline. Props: `revenueByMonth`, `revenueMTD`, `onPress`. Empty state: muted "No revenue yet".
- [x] 3.3 Add an optional ≤200ms reanimated fade/scale entrance to both components, gated by reduced-motion (fall back to static render). Keep it optional — components must render correctly without animation.

## 4. Mobile — wire into the dashboard screen

- [x] 4.1 Update `apps/mobile/src/hooks/use-dashboard-data.ts` types to include the two new `mobileOverview` fields (types are auto-derived from the Convex generated schema; verify the regenerated `api.d.ts` picks them up after `convex dev` regenerates).
- [x] 4.2 In `apps/mobile/app/(app)/index.tsx`, replace the lone "Open deals" `KpiCard` tile with the `PipelineBar` block (taps → `/(app)/deals`).
- [x] 4.3 In the same file, replace the lone "Revenue MTD" `KpiCard` tile with the `RevenueSparkline` block (taps → `/(app)/invoices`), keeping the MTD figure as the headline number.
- [x] 4.4 Update the `isWorkspaceEmpty` early-return predicate to also require all `dealsByStage` counts zero AND all `revenueByMonth` revenues zero. When only the visuals are empty but attention items exist, each block renders its own muted empty state (don't treat the screen as fully empty).
- [x] 4.5 Update the `DashboardSkeleton` to reserve space for the two new visual blocks (two skeleton rectangles sized to match the real blocks) so the loading→data transition doesn't jump.

## 5. Verification

- [x] 5.1 Run `bun test` (or the repo's test command) for the Convex dashboard tests; confirm the two new fields and empty-workspace cases pass.
- [ ] 5.2 Run the mobile app (`bun --filter mobile dev` or the repo's mobile dev command) and visually verify on a workspace with: (a) deals across all 5 stages + 6 months of revenue, (b) a brand-new empty workspace, (c) a workspace with overdue items but zero deals/revenue.  
  *Not executed in this session:* starting the Expo dev server requires a simulator/device and is long-running; left for local review. Mobile type-check and the full test suite pass as a substitute.
- [x] 5.3 Confirm no new native dependencies were added (`apps/mobile/package.json` unchanged) and `react-native-reanimated` is the only animation dep used.
- [x] 5.4 Confirm the web dashboard and `analytics.*` queries are untouched (`git diff -- convex/analytics.ts apps/web` empty for this change).
