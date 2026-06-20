Review only. Do not edit files.

Worktree: /Users/madearga/Desktop/crm/.worktrees/quality-audit-cleanup
Commit to review: 0e5e3f9

Spec:
- Make both `pnpm --filter @crm/web lint` and `pnpm --filter @crm/web typecheck` exit successfully.
- Fix minimally; avoid broad refactors.
- Convex generated files may exist as ignored setup artifact but must not be committed.
- Preserve behavior.
- Commit only relevant source/doc files.

Please inspect `git show --stat 0e5e3f9`, `git show 0e5e3f9`, and current status as needed.
Return:
SPEC_REVIEW: PASS or FAIL
FINDINGS: bullets
