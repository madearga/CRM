# Code Review Synthesis — Dashboard Polish

**Scope:** `apps/web/src/app/(dashboard)/page.tsx` + supporting files  
**Base:** `300574ea29e1868b09b88df82f4543dfdc6dbf93`  
**Branch:** `feat/how-llm-works-html`  
**Intent:** Polish the dashboard UI without breaking any logic.

## Reviewers

- correctness
- maintainability
- project-standards
- kieran-typescript
- adversarial
- testing (synthesized after sub-agent pane failure)

## Applied fixes (already committed to working tree)

1. **Fixed loading gate (correctness/maintainability)** — `isLoading` now includes `agingLoading`, `productsLoading`, `comparisonLoading`, and waits for `analyticsOverview` to resolve. Prevents polished KPI cards from flashing `$0` while queries load.
2. **Deduplicated overdue check (maintainability)** — extracted `const hasOverdue = (analyticsOverview?.overdueAmount ?? 0) > 0;` and reused it for border/dot/text/helper-text.
3. **Reused shared EmptyState (project-standards)** — removed local `EmptyState` shadow; introduced a thin `DashboardEmptyState` wrapper that composes `@/components/empty-state` with a `Button`/`Link` action.
4. **Hardened date formatters (adversarial P0 finding)** — `formatDistanceToNow` and `format` in `lib/format-date.ts` now return `'—'` for non-finite/Invalid Date input instead of throwing `RangeError` and crashing the dashboard.
5. **Fixed InsightsWidget due-soon filtering (adversarial)** — `InsightsWidget` now parses ISO-string `dueAt` safely and falls back when the value is missing/invalid, so urgent activities are no longer silently dropped.
6. **Passed numeric timestamps directly to formatters** — dashboard page now calls `formatDistanceToNow(activity.createdAt)` and `format(activity.dueAt, ...)` without wrapping in `new Date()`, letting the hardened formatters handle coercion safely.

## Remaining findings (not addressed)

| Severity | Finding | Why not fixed |
|---|---|---|
| P2/P3 | `forecastData?.map((s: any)` in PipelineChart mapper | Pre-existing; not introduced by polish. Narrowing type is outside "no logic change" scope. |
| P2/P3 | Icon props typed as `typeof FileText` / `typeof Phone` | Pre-existing pattern; works. Switching to `LucideIcon` is cosmetic. |
| P2/P3 | Hardcoded route strings (`/deals`, `/invoices`) | Routes exist. Adding typed route constants is a larger refactor. |
| P3 | Activity rows link to `/activities` list instead of per-record | No per-record activity detail route exists in the app. |
| P3 | Whole-card links fragile to future nested interactive children | Current markup is valid; future additions need awareness. |
| P3 | Rapid date-range switching can refetch aggressively | Pre-existing behavior; debounce is a feature, not a polish fix. |
| P2 | No new tests for DashboardEmptyState / KPI hrefs / date fallback | Out of scope for a quick polish; noted as testing gap. |

## Verdict

**Ready with fixes.** The polish itself is safe. The one critical issue identified (invalid-date crash) has been fixed defensively, and the loading-gate fix prevents a visible regression introduced by making the cards interactive links. Remaining items are pre-existing or advisory and do not block merge.

## Artifacts

- `.context/compound-engineering/ce-code-review/20260614-124542-f308fe04/{correctness,maintainability,project-standards,kieran-typescript,adversarial,testing}.json`
- `.context/compound-engineering/ce-code-review/20260614-124542-f308fe04/page.diff`
- `.context/compound-engineering/ce-code-review/20260614-124542-f308fe04/metadata.json`
