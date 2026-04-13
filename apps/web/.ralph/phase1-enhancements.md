# Phase 1 Enhancements — Auto-Execute

Execute all 6 tasks from `docs/plans/2026-04-13-phase1-enhancements.md` automatically.

## Working Directory
`/Users/madearga/Desktop/crm`

## CRITICAL convex-ents quirk
In `.field()` chaining, must use `v.optional(v.string())` NOT `v.string().optional()`.

## Execution Rules
- Read the plan file at the start of each iteration
- Execute ONE task per iteration (Task 1 → Task 2 → ... → Task 6)
- For each task: create files → run `pnpm typecheck` → commit → push
- Do NOT ask for confirmation — just execute
- If typecheck fails, fix the issue before committing
- After all 6 tasks, run final verification (Task 6)

## Task Checklist
- [ ] Task 1: CSV Export Utility (`apps/web/src/lib/export-csv.ts` + `apps/web/src/components/data-table-export-button.tsx`)
- [ ] Task 2: Export Buttons on List Pages (invoices, subscriptions, contacts, companies)
- [ ] Task 3: Recurring Invoices Backend (`convex/schema.ts` + `convex/recurringInvoices.ts` + `convex/crons.ts`)
- [ ] Task 4: Recurring Invoices UI (`apps/web/src/app/(dashboard)/settings/recurring-invoices/` + create dialog)
- [ ] Task 5: Dashboard Analytics (`convex/analytics.ts` + enhance dashboard page)
- [ ] Task 6: Verification (typecheck + lint + convex dev + push)

## Commit Messages
- Task 1: `feat(export): add CSV export utility and button component`
- Task 2: `feat(export): add CSV export buttons to list pages`
- Task 3: `feat(invoices): add recurring invoices with cron-based generation`
- Task 4: `feat(invoices): add recurring invoices management UI`
- Task 5: `feat(analytics): add dashboard analytics with revenue, pipeline, and KPI cards`
- Task 6: verification commit if needed