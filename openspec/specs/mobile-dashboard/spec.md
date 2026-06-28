# mobile-dashboard Specification

## Purpose
TBD - created by archiving change mobile-dashboard-visualizations. Update Purpose after archive.

## Requirements
### Requirement: Mobile dashboard SHALL render a pipeline-by-stage visual
The mobile dashboard home screen SHALL display a pipeline distribution block showing all 5 deal stages (new, contacted, proposal, won, lost) as a horizontal proportional stacked bar, with a compact per-stage chip row beneath it showing each stage's count and value. The block SHALL be served by the single `dashboard.mobileOverview` query (no extra round trips). Tapping the block SHALL navigate to the deals tab.

#### Scenario: Workspace with deals across multiple stages
- **WHEN** `mobileOverview` returns `dealsByStage` with counts across 5 stages
- **THEN** the stacked bar renders 5 segments whose widths are proportional to each stage's count, colored per the shared stage-color map, and the chip row shows each stage's count and formatted-currency value

#### Scenario: Workspace with deals in only one stage
- **WHEN** only one stage has a non-zero count
- **THEN** the bar renders a single full-width segment for that stage and the other 4 chips show `0` / `—`

#### Scenario: Workspace with zero deals
- **WHEN** `mobileOverview.dealsByStage` is empty or all counts are zero
- **THEN** the block renders a muted "No pipeline data yet" empty state and does not render an empty bar

#### Scenario: Tap to drill in
- **WHEN** the user taps anywhere on the pipeline block
- **THEN** the app navigates to the deals tab (`/(app)/deals`)

### Requirement: Mobile dashboard SHALL render a 6-month revenue sparkline
The mobile dashboard home screen SHALL display a revenue trend block showing the last 6 calendar months as 6 vertical mini-bars, with the current month highlighted. The block SHALL keep the existing Revenue-MTD figure as its headline number. Data SHALL come from `dashboard.mobileOverview.revenueByMonth` (no extra round trips). Tapping the block SHALL navigate to the invoices tab.

#### Scenario: Six months of revenue available
- **WHEN** `mobileOverview.revenueByMonth` contains 6 entries
- **THEN** 6 mini-bars render with heights proportional to each month's revenue relative to the max month, the current (last) month is visually highlighted, and each bar's minimum rendered height is 2dp so low-revenue months remain visible

#### Scenario: Partial history (fewer than 6 months)
- **WHEN** `revenueByMonth` contains fewer than 6 entries (e.g., new workspace)
- **THEN** the available months render as bars and the older missing months are omitted (no zero-padded ghost bars)

#### Scenario: Zero revenue across all months
- **WHEN** every entry in `revenueByMonth` has `revenue === 0`
- **THEN** the block renders a muted "No revenue yet" empty state in place of the sparkline

#### Scenario: Tap to drill in
- **WHEN** the user taps anywhere on the revenue block
- **THEN** the app navigates to the invoices tab (`/(app)/invoices`)

### Requirement: `dashboard.mobileOverview` SHALL return pipeline-by-stage and 6-month revenue series
The `dashboard.mobileOverview` Convex query SHALL extend its current return shape with `dealsByStage: { stage, count, value }[]` (all 5 stages, including won and lost) and `revenueByMonth: { month, revenue }[]` (last 6 calendar months). The extension SHALL NOT break the single-round-trip contract and SHALL keep all reads bounded by documented caps. The 6-month revenue query SHALL be capped at `REVENUE_6M_CAP = 500` invoices and filtered to revenue invoices (non-cancelled customer invoices, unarchived). Won/lost stage counts SHALL come from `aggregateDealsByStage` (bounded index reads).

#### Scenario: Query returns the two new series alongside existing fields
- **WHEN** an authenticated user with an active organization calls `mobileOverview`
- **THEN** the response contains the existing scalars/lists unchanged, plus `dealsByStage` with 5 entries and `revenueByMonth` with up to 6 entries ordered oldest-to-newest

#### Scenario: Workspace with no invoices in the last 6 months
- **WHEN** there are zero revenue invoices in the last 6 months
- **THEN** `revenueByMonth` returns up to 6 entries each with `revenue: 0` (one per month in range), so the client can distinguish "no data" from "zero revenue"

#### Scenario: 6-month invoice query hits the cap
- **WHEN** more than `REVENUE_6M_CAP` revenue invoices exist in the last 6 months
- **THEN** the query processes only the first `REVENUE_6M_CAP` (ordered by invoiceDate) and the cap is documented in the code comment block alongside the existing P0 caps

#### Scenario: Unauthenticated or no active organization
- **WHEN** the caller has no active organization
- **THEN** the query throws `ConvexError({ code: 'UNAUTHORIZED' })` unchanged (existing behavior preserved)

### Requirement: Pipeline and revenue visuals SHALL share stage colors with the web dashboard
The mobile pipeline-by-stage block SHALL use the same stage-color mapping as the web dashboard (`STAGE_CHART_COLORS` / `STAGE_BAR_COLORS`). The mapping SHALL come from a single shared source (in `packages/domain` or a shared constants module) imported by both web and mobile, to avoid two sources of truth drifting.

#### Scenario: Stage colors match web
- **WHEN** the mobile pipeline bar renders a segment for stage `proposal`
- **THEN** the segment color is identical to the web `STAGE_CHART_COLORS.proposal` value

#### Scenario: Unknown stage
- **WHEN** `dealsByStage` contains a stage not present in the color map
- **THEN** the segment falls back to a default primary color and the chip still renders with the stage name

### Requirement: Mobile dashboard visual blocks SHALL degrade on empty workspace
The mobile dashboard's existing `isWorkspaceEmpty` early-return logic SHALL be updated so that a workspace with zero deals AND zero revenue invoices still shows the friendly first-run `EmptyState`, and the two new visual blocks are not rendered in that state.

#### Scenario: Brand-new workspace
- **WHEN** `openDealsCount === 0` AND `overdueActivitiesCount === 0` AND `recentActivities.length === 0` AND `overdueInvoices.length === 0` AND all `dealsByStage` counts are zero AND all `revenueByMonth` revenues are zero
- **THEN** the screen renders the existing `EmptyState` with the "Log an activity" CTA and does not render the pipeline or sparkline blocks

#### Scenario: Workspace with only overdue items, no deals/revenue
- **WHEN** overdue items exist but `dealsByStage` is all-zero and `revenueByMonth` is all-zero
- **THEN** the attention section renders, and the pipeline/sparkline blocks each render their own muted "No … yet" empty state (the screen is not treated as fully empty)