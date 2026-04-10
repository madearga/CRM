# Fix All Code Review & Engineering Review Findings

## Workstream A: fix-all-review-findings (P0-P3)
- [x] P0: Delete `convex/debug_auth.ts` ✅ DONE
- [ ] P1: Fix `session.onCreate` — replace `.catch(() => null)` with proper null check + warning log
- [ ] P1: Fix `session._id` patch — add try/catch around `getX().patch()`
- [ ] P1: Connect CRM rate limit keys to actual mutations (companies, contacts, deals, activities)
- [ ] P2: Extract shared `findMainUserByEmail` helper from user.onCreate and session.onCreate
- [ ] P2: Reduce `as any` casts with proper types where possible
- [x] P3: suppressHydrationWarning — skip (no change needed)

## Workstream B: crm-eng-review-fixes (1A-8A)
- [ ] Issue 1A: Import isValidTransition from packages/domain in convex/deals.ts (remove duplicate VALID_TRANSITIONS)
- [ ] Issue 7A: Add returns schema to contacts queries
- [ ] Issue 5A: Add convex-ents mitigation note to README
- [ ] Issue 4B: Add runtime validation + comments to auth.ts
- [ ] Issue 6A: Create createOrgQuery/createOrgMutation wrappers, refactor all handlers
- [ ] Issue 2A: Add lastActivityAt field on contacts schema + trigger
- [ ] Issue 3A: Implement cursor-based pagination for all list queries
- [ ] Issue 8A: Add Convex function tests for all critical paths