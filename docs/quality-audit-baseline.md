# Quality Audit Baseline

Source report from user:
- Accessibility: 51 issues
- Architecture: 727 issues
- Correctness: 138 issues
- Dead Code: 97 issues
- Performance: 89 issues

Local verifier at start:
- `pnpm --filter @crm/web lint`: failed on missing `EmptyState` import in `apps/web/src/app/(dashboard)/hr/reports/page.tsx`
- `pnpm --filter @crm/web typecheck`: failed on missing Vite type reference, missing `PdfDownloadButton.disabled`, missing `EmptyState`, missing `override` modifiers in `ErrorBoundary`, and a non-object spread in `convex/hrEmployees.ts`

Baseline cleanup commit:
- `0e5e3f9 fix(web): restore clean baseline lint + typecheck`

Baseline after cleanup:
- `pnpm --filter @crm/web lint`: PASS with 19 pre-existing warnings
- `pnpm --filter @crm/web typecheck`: PASS

Scope:
- Frontend-first cleanup under `apps/web`
- Avoid backend/Convex behavior changes except minimal typecheck baseline fixes
- `convex/_generated` may exist in the worktree as an ignored setup artifact and must not be committed
