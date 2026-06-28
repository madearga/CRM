## Why

The mobile dashboard (`apps/mobile/app/(app)/index.tsx`) currently shows only an attention card, two flat KPI tiles (Open deals, Revenue MTD), and a list — every number is text, with zero graphical signal. On a phone, where glanceable shape matters most, users cannot see pipeline distribution or revenue trend without navigating away. The web dashboard already charts both; mobile is the gap.

## What Changes

- **Extend `dashboard.mobileOverview`** to return two small series alongside its current scalars — `dealsByStage` (5 stages, count + value) and `revenueByMonth` (last 6 months, month label + revenue) — without breaking the single-round-trip contract or the documented read-budget caps.
- **Add a pipeline-by-stage visual block** to the mobile dashboard: a horizontal proportional stacked bar (segments colored per stage) plus a compact chip row showing per-stage count and value. Replaces the lone "Open deals" KPI tile. Taps deep-link to `/deals`.
- **Add a revenue MTD sparkline block**: 6 mini vertical bars (last 6 months), current month highlighted, with the existing MTD figure kept as the headline number. Taps deep-link to `/invoices`.
- **Add two presentational components** (`pipeline-bar.tsx`, `revenue-sparkline.tsx`) built from pure nativewind `View`s — no new chart library dependency.

## Capabilities

### New Capabilities
- `mobile-dashboard`: glanceable, visual mobile home screen — attention section, pipeline-by-stage visual, revenue trend sparkline, and activity list, all served by one consolidated query.

### Modified Capabilities
<!-- None — no existing spec-level capability changes. The Convex `dashboard.overview`/`mobileOverview` queries are implementation, not a versioned spec. -->

## Impact

- **Backend**: `convex/dashboard.ts` — extend `mobileOverview` returns + handler (add 2 aggregate calls for won/lost stage counts; add one capped 6-month `organizationId_invoiceDate` query bucketed by month). Update `convex/__tests__/dashboard.test.ts` for the new fields.
- **Mobile app**: `apps/mobile/app/(app)/index.tsx` — render two new visual blocks; `apps/mobile/src/components/pipeline-bar.tsx` and `revenue-sparkline.tsx` — new; `apps/mobile/src/hooks/use-dashboard-data.ts` — type updates (auto-derived from Convex schema).
- **Dependencies**: none. Reuses `nativewind` + existing `react-native-reanimated` for optional entrance animation. No `react-native-gifted-charts` / `victory-native` / `react-native-skia`.
- **Read-budget**: net add is small and capped (documented in code). Well under Convex function limits. No regression to the P0 read-budget fix already in `mobileOverview`.
- **Web**: untouched. Web dashboard keeps its own 8-query pattern.