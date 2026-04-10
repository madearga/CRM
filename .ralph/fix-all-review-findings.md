## Goal
Fix all code review findings (P0-P3) from the review.

## Checklist
- [x] P0: Delete `convex/debug_auth.ts` (security risk — internalMutation bypass auth)
- [ ] P1: Fix `session.onCreate` — replace `.catch(() => null)` with proper null check + warning log
- [ ] P1: Fix `session._id` patch — add try/catch around `getX().patch()`
- [ ] P1: Connect CRM rate limit keys to actual mutations (companies, contacts, deals, activities)
- [ ] P2: Extract shared `findMainUserByEmail` helper from user.onCreate and session.onCreate
- [ ] P2: Reduce `as any` casts with proper types where possible
- [ ] P3: Note suppressHydrationWarning is standard for next-themes (no change needed)
