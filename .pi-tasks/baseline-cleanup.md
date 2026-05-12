Implement baseline cleanup before main quality-audit plan.

Context:
- Repo worktree: /Users/madearga/Desktop/crm/.worktrees/quality-audit-cleanup
- Branch: fix/quality-audit-cleanup
- User requested subagent-driven with caveman worker. Native subagent tool is unavailable outside cmux/tmux, so this is delegated via Pi CLI dispatch using caveman-worker style.
- Keep communication terse/caveman, but code quality high.
- Do NOT touch parent repo outside this worktree.
- Frontend cleanup preferred, but typecheck baseline includes one Convex TS error; fix minimally if needed.

Current baseline commands:
1. `pnpm --filter @crm/web lint`
   - Fails with `apps/web/src/app/(dashboard)/hr/reports/page.tsx:222:10 error 'EmptyState' is not defined react/jsx-no-undef`
   - Also has warnings; warnings are okay if command exits 0.
2. `pnpm --filter @crm/web typecheck`
   - Fails with:
     - `src/__tests__/setup.ts:1:23 Cannot find type definition file for 'vite/client'`
     - `src/app/(dashboard)/hr/reports/page.tsx:151 Property 'disabled' does not exist on type 'PdfDownloadButtonProps'`
     - `src/app/(dashboard)/hr/reports/page.tsx:222 Cannot find name 'EmptyState'`
     - `src/components/error-boundary.tsx:18 state must have override modifier`
     - `src/components/error-boundary.tsx:24 render must have override modifier`
     - `../../convex/hrEmployees.ts:132 Spread types may only be created from object types`

Task:
- Make both `pnpm --filter @crm/web lint` and `pnpm --filter @crm/web typecheck` exit successfully.
- Fix minimally; avoid broad refactors.
- If Convex generated files are needed, note that `convex/_generated` was copied into this worktree as ignored setup artifact; do not commit generated files.
- Preserve behavior.
- After fixes, run both commands.
- Commit only relevant tracked/new source/doc files on branch with a clear message, e.g. `fix(web): restore clean baseline checks`.

Return format:
STATUS: DONE / DONE_WITH_CONCERNS / BLOCKED / NEEDS_CONTEXT
SUMMARY: terse bullets
VERIFICATION: exact commands + pass/fail
COMMIT: short SHA or none
CONCERNS: if any
