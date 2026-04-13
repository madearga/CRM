# Code Review Fixes — Auto-Execute

Execute all 7 tasks from `docs/plans/2026-04-13-code-review-fixes.md` automatically.

## Working Directory
`/Users/madearga/Desktop/crm`

## CRITICAL convex-ents quirk
In `.field()` chaining, must use `v.optional(v.string())` NOT `v.string().optional()`.

## Execution Rules
- Read the plan file at the start of each iteration
- Execute ONE task per iteration (Task 1 → Task 2 → ... → Task 7)
- For each task: read plan → apply changes → run `pnpm typecheck` → commit
- Do NOT ask for confirmation — just execute
- If typecheck fails, fix the issue before committing
- After all 7 tasks are done, mark loop complete

## Task Checklist
- [ ] Task 1: Fix insecure token generation (P0) — crypto.getRandomValues
- [ ] Task 2: Fix race condition in joinViaLink (P0) — re-read pattern
- [ ] Task 3: Fix usePublicQuery → useAuthQuery (P1) — permissions hook
- [ ] Task 4: Optimize N+1 query in permissionTemplates.list (P1) — batch reads
- [ ] Task 5: Fix fragile invitation patch + error handling (P1)
- [ ] Task 6: Fix flash of empty sidebar/tabs on load (P2)
- [ ] Task 7: Remove unused user variable in settings layout (P2)

## Commit Messages
- Task 1: `fix(security): use crypto.getRandomValues for invite token generation`
- Task 2: `fix(security): fix race condition in joinViaLink with re-read pattern`
- Task 3: `fix(permissions): use useAuthQuery instead of usePublicQuery`
- Task 4: `perf(permissions): optimize N+1 query in permissionTemplates.list`
- Task 5: `fix(invitations): fix fragile patch and add error handling`
- Task 6: `fix(ui): fix flash of empty sidebar/tabs on load`
- Task 7: `cleanup: remove unused user variable in settings layout`