# Sales Order Module Refinement Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all P1/P2/P3 issues identified in the code review to ensure data integrity, performance, and better UX.

**Architecture:** Refine backend mutations to be safer (atomic-like), optimize queries (batching/indexing), and improve frontend form/detail pages.

**Tech Stack:** Convex, `convex-ents`, TypeScript, React, Tailwind CSS.

---

### Task 1: Type Safety & Validation (P1/P2/P3)

**Files:**
- Modify: `convex/saleOrders.ts`
- Modify: `convex/schema.ts`

**Step 1: Fix `recalculateTotals` types and add doc for race condition**
Update `recalculateTotals` to use `AuthMutationCtx` and `EntWriter<'saleOrders'>`.

**Step 2: Add validation to `calculateLineSubtotal` and Zod schema**
Add `.min(0)` to `discount` and `taxAmount` in `lineSchema` and `calculateLineSubtotal`.

**Step 3: Fix `VALID_TRANSITIONS` type safety (P3)**
Use `Record<z.infer<typeof stateEnum>, string[]>` for `VALID_TRANSITIONS`.

**Step 4: Add `source` enum to schema (P2)**
Update `saleOrders.source` in `convex/schema.ts` to use `v.union(v.literal('deal'), v.literal('manual'))`.

**Step 5: Clean up dead imports**
Remove `import type { SequenceType }` in `convex/saleOrders.ts`.

**Step 6: Run typecheck**
Run: `npx convex typecheck`

**Step 7: Commit**
`git commit -m "fix(sales): improve type safety and add schema validations"`

---

### Task 2: Fix Deal Conversion Duplication (P1)

**Files:**
- Modify: `convex/deals.ts`
- Modify: `convex/schema.ts`

**Step 1: Add `convertedToSaleOrderId` to `deals` schema**
Add `convertedToSaleOrderId: v.optional(v.id('saleOrders'))` to `deals` table in `convex/schema.ts`.

**Step 2: Implement check in `convertToSaleOrder`**
In `convex/deals.ts`, check if `deal.convertedToSaleOrderId` exists before converting. Patch it after creation.

**Step 3: Commit**
`git commit -m "fix(sales): prevent duplicate deal conversion"`

---

### Task 4: Optimize List Query (P2)

**Files:**
- Modify: `convex/saleOrders.ts`
- Modify: `convex/schema.ts`

**Step 1: Add `organizationId_archivedAt` index**
Add index to `saleOrders` table in `convex/schema.ts`.

**Step 2: Fix N+1 and memory filtering in `list` query**
Use `Promise.all` for name resolution and filter `archivedAt` in the DB query, not in JS.

**Step 3: Commit**
`git commit -m "perf(sales): fix N+1 and memory filtering in list query"`

---

### Task 5: Enhance Update Mutation & Duplicate logic (P2/P3)

**Files:**
- Modify: `convex/saleOrders.ts`

**Step 1: Support updating lines in `update` mutation (P2)**
Allow passing `lines` to `update` to replace existing lines and trigger recalculation.

**Step 2: Clear `validUntil` in `duplicate` (P3)**
Set `validUntil: undefined` in the duplicated record.

**Step 3: Commit**
`git commit -m "fix(sales): enhance update mutation and duplication logic"`

---

### Task 6: Frontend Refinements (P2/P3)

**Files:**
- Modify: `apps/web/src/app/(dashboard)/sales/columns.tsx`
- Modify: `apps/web/src/components/sales/sale-order-form.tsx`
- Modify: `apps/web/src/components/sales/line-item-editor.tsx`
- Modify: `apps/web/src/app/(dashboard)/deals/[id]/page.tsx`

**Step 1: Remove dead import in `sale-order-form.tsx` (P2)**

**Step 2: Add row actions in `columns.tsx` (P3)**
Add Edit/Duplicate actions to the table.

**Step 3: Fix `LineItemEditor` dropdown blur (P3)**
Use a better trigger/popover for product search to ensure it closes properly.

**Step 4: Update Deal conversion flow (P2)**
Optionally navigate to new SO form with pre-filled data instead of instant conversion.

**Step 5: Run build verification**
`cd apps/web && bun run build`

**Step 6: Commit**
`git commit -m "fix(sales): frontend refinements and row actions"`
