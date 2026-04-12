# Sale Order Form Bugfixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 7 issues in `sale-order-form.tsx` identified by code review — 2 critical bugs, type safety, validation, performance, UX, and edge case.

**Architecture:** Targeted fixes in `sale-order-form.tsx`, `line-item-editor.tsx`, and backend `saleOrders.ts`. No new dependencies. Each fix is isolated and committable independently.

**Tech Stack:** React 19, TypeScript, Convex, Zod, Radix UI, Next.js 15

---

### Task 1: Fix Tax Double-Counting Bug (🔴 Critical)

**Files:**
- Modify: `src/components/sales/sale-order-form.tsx:86-102`
- Modify: `src/components/sales/line-item-editor.tsx` (calculateSubtotal function)

**Problem:** `subtotal` already includes `l.taxAmount` per line (line 91). Then `tax` sums all `l.taxAmount` again (line 101). Total = `sub - disc + tax` → tax added twice.

**Step 1: Fix subtotal calculation to EXCLUDE tax**

In `sale-order-form.tsx`, the `useMemo` block (lines 86-104), change the subtotal reduce:

```typescript
const sub = form.lines.reduce((sum, l) => {
  let lineTotal = l.quantity * l.unitPrice;
  if (l.discount) {
    if (l.discountType === 'percentage') lineTotal -= lineTotal * (l.discount / 100);
    else lineTotal -= l.discount;
  }
  // Do NOT add tax here — tax is summed separately below
  return sum + lineTotal;
}, 0);
```

Remove the `if (l.taxAmount) lineTotal += l.taxAmount;` line from the subtotal reduce.

**Step 2: Fix calculateSubtotal in line-item-editor.tsx**

Same fix — remove tax from the per-line subtotal display:

```typescript
function calculateSubtotal(line: LineItem): number {
  let subtotal = line.quantity * line.unitPrice;
  if (line.discount) {
    if (line.discountType === 'percentage') {
      subtotal -= subtotal * (line.discount / 100);
    } else {
      subtotal -= line.discount;
    }
  }
  // Tax shown separately in its column — don't include in subtotal
  return Math.round(subtotal * 100) / 100;
}
```

**Step 3: Verify fix**

Open browser at `/sales/new`, add a line item with qty=2, price=100, tax=10.
- Subtotal should show: 200
- Tax should show: 10
- Total should show: 210 (NOT 220)

**Step 4: Commit**

```bash
git add src/components/sales/sale-order-form.tsx src/components/sales/line-item-editor.tsx
git commit -m "fix(sales): remove tax double-counting in subtotal calculation"
```

---

### Task 2: Fix Edit Mutation Missing Lines (🔴 Critical)

**Files:**
- Modify: `src/components/sales/sale-order-form.tsx:142-175`
- Modify: `../../convex/saleOrders.ts` (update mutation)

**Problem:** `handleSubmit` only sends header fields on edit, never sends updated `lines`. Line item changes are silently dropped.

**Step 1: Add line update support to Convex update mutation**

In `convex/saleOrders.ts`, add `lines` to the update mutation args and handler:

```typescript
export const update = createOrgMutation()({
  args: {
    id: zid('saleOrders'),
    // ... existing args ...
    lines: z.optional(z.array(z.object({
      productName: z.string(),
      description: z.string().optional(),
      quantity: z.number().min(0.01),
      unitPrice: z.number(),
      discount: z.number().optional(),
      discountType: z.enum(['percentage', 'fixed']).optional(),
      taxAmount: z.number().optional(),
      productId: zid('products').optional(),
      productVariantId: zid('productVariants').optional(),
    })).min(1)),
  },
  // ... returns same ...
  handler: async (ctx, args) => {
    const { id, lines: updatedLines, ...updates } = args;
    // ... existing validation ...

    // If lines are provided, replace all existing lines
    if (updatedLines) {
      const existingLines = await so.edge('lines');
      for (const line of existingLines) {
        await line.delete();
      }
      const lineSubtotals = updatedLines.map((line) => ({
        ...line,
        subtotal: calculateLineSubtotal(line),
      }));
      for (const line of lineSubtotals) {
        await ctx.table('saleOrderLines').insert({
          ...line,
          saleOrderId: id,
          organizationId: ctx.orgId,
        });
      }
      await recalculateTotals(ctx, so);
    }

    // ... rest of existing handler (discount recalc, patch, audit log) ...
  },
});
```

**Step 2: Send lines in edit payload from frontend**

In `sale-order-form.tsx`, `handleSubmit`, change the edit branch:

```typescript
if (isEdit) {
  await updateSO.mutateAsync({
    id: saleOrderId as any,
    companyId: payload.companyId,
    contactId: payload.contactId,
    orderDate: payload.orderDate,
    validUntil: payload.validUntil,
    deliveryDate: payload.deliveryDate,
    deliveryAddress: payload.deliveryAddress,
    internalNotes: payload.internalNotes,
    customerNotes: payload.customerNotes,
    terms: payload.terms,
    discountAmount: payload.discountAmount,
    discountType: payload.discountType,
    lines: payload.lines,  // ← ADD THIS LINE
  });
```

**Step 3: Verify fix**

Edit an existing sale order, add/remove/change line items, save. Refresh page — line changes should persist.

**Step 4: Commit**

```bash
git add src/components/sales/sale-order-form.tsx ../../convex/saleOrders.ts
git commit -m "fix(sales): send line items on edit mutation"
```

---

### Task 3: Replace `any` Types with Proper TypeScript Types (🟠)

**Files:**
- Modify: `src/components/sales/sale-order-form.tsx`

**Step 1: Replace `any` with typed interfaces**

At top of file, add typed interfaces:

```typescript
interface CompanyOption { id: string; name: string }
interface ContactOption { id: string; fullName: string }

type FormState = {
  companyId: string;
  contactId: string;
  orderDate: string;
  validUntil: string;
  deliveryDate: string;
  deliveryAddress: string;
  internalNotes: string;
  customerNotes: string;
  terms: string;
  discountAmount: string;
  discountType: 'percentage' | 'fixed';
  lines: LineItem[];
};
```

Replace all `(c: any)` with typed versions:
- `(companies ?? []).map((c: any)` → `(companies ?? []).map((c: CompanyOption)`
- `(contacts ?? []).map((c: any)` → `(contacts ?? []).map((c: ContactOption)`

Replace `const payload: any` with typed payload:

```typescript
const payload: {
  companyId?: string;
  contactId?: string;
  orderDate: number;
  validUntil?: number;
  deliveryDate?: number;
  deliveryAddress?: string;
  internalNotes?: string;
  customerNotes?: string;
  terms?: string;
  discountAmount?: number;
  discountType?: 'percentage' | 'fixed';
  lines: Array<{
    productName: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
    discountType?: 'percentage' | 'fixed';
    taxAmount?: number;
    productId?: string;
    productVariantId?: string;
  }>;
} = { ... };
```

Replace `(v: any)` in discount select with `(v: 'percentage' | 'fixed')`.

**Step 2: Verify**

Run: `pnpm typecheck`
Expected: PASS (or fewer `any` errors)

**Step 3: Commit**

```bash
git add src/components/sales/sale-order-form.tsx
git commit -m "refactor(sales): replace any types with proper TypeScript interfaces"
```

---

### Task 4: Add Form Validation (🟠)

**Files:**
- Modify: `src/components/sales/sale-order-form.tsx`

**Step 1: Add validation helper before submit**

Before the `validLines` check in `handleSubmit`, add:

```typescript
const errors: string[] = [];

if (!form.orderDate) errors.push('Order date is required');
if (validLines.some((l) => !l.quantity || l.quantity <= 0)) errors.push('All line items must have quantity > 0');
if (validLines.some((l) => !l.unitPrice || l.unitPrice < 0)) errors.push('All line items must have a valid price');

if (errors.length > 0) {
  toast.error(errors.join('. '));
  return;
}
```

**Step 2: Verify**

Try submitting with empty date or zero quantity. Error toast should appear.

**Step 3: Commit**

```bash
git add src/components/sales/sale-order-form.tsx
git commit -m "feat(sales): add form validation for required fields and line items"
```

---

### Task 5: Fix Timezone Trap with Date Parsing (🟡)

**Files:**
- Modify: `src/components/sales/sale-order-form.tsx`

**Step 1: Replace `new Date(string).getTime()` with timezone-safe parsing**

Add utility at top:

```typescript
function dateToTimestamp(dateStr: string): number {
  if (!dateStr) return 0;
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d, 12, 0, 0); // noon UTC avoids day shift
}
```

Replace all `new Date(form.orderDate).getTime()` → `dateToTimestamp(form.orderDate)`, same for validUntil, deliveryDate.

Replace `new Date(initialData.orderDate).toISOString().split('T')[0]` in useEffect:

```typescript
function timestampToDate(ts: number): string {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
```

Use `timestampToDate(initialData.orderDate)` etc. in the useEffect.

**Step 2: Verify**

Run in UTC+7 timezone. Create order with date 2026-04-12. Save. Reload. Date should still be 2026-04-12 (not 2026-04-11).

**Step 3: Commit**

```bash
git add src/components/sales/sale-order-form.tsx
git commit -m "fix(sales): use UTC date parsing to avoid timezone shift"
```

---

### Task 6: Add Unsaved Changes Guard (🟡 UX)

**Files:**
- Modify: `src/components/sales/sale-order-form.tsx`

**Step 1: Track dirty state and add beforeunload + route guard**

Add import:

```typescript
import { useCallback, useRef } from 'react';
```

Add dirty tracking after form state:

```typescript
const isDirty = useRef(false);

// Wrap setForm to track changes
const updateForm = useCallback((updater: (prev: FormState) => FormState) => {
  isDirty.current = true;
  setForm(updater);
}, []);
```

Replace all `setForm(` calls with `updateForm(`.

Add beforeunload guard:

```typescript
useEffect(() => {
  const handler = (e: BeforeUnloadEvent) => {
    if (isDirty.current) {
      e.preventDefault();
    }
  };
  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
}, []);
```

Modify Cancel button and back button to confirm:

```typescript
const handleCancel = () => {
  if (isDirty.current) {
    if (!confirm('You have unsaved changes. Discard?')) return;
  }
  router.back();
};
```

**Step 2: Verify**

Type something in form. Click Cancel. Confirm dialog should appear.

**Step 3: Commit**

```bash
git add src/components/sales/sale-order-form.tsx
git commit -m "feat(sales): add unsaved changes guard with confirmation dialog"
```

---

### Task 7: Optimize State for Performance (🟡)

**Files:**
- Modify: `src/components/sales/sale-order-form.tsx`

**Step 1: Split monolithic form state**

Split `form` into header state and lines state so line edits don't trigger full re-render of header fields:

```typescript
const [header, setHeader] = useState({
  companyId: '',
  contactId: '',
  orderDate: new Date().toISOString().split('T')[0],
  validUntil: '',
  deliveryDate: '',
  deliveryAddress: '',
  internalNotes: '',
  customerNotes: '',
  terms: '',
  discountAmount: '',
  discountType: 'percentage' as 'percentage' | 'fixed',
});

const [lines, setLines] = useState<LineItem[]>([{ productName: '', quantity: 1, unitPrice: 0 }]);
```

Update all `form.xxx` → `header.xxx` for header fields and `form.lines` → `lines`.
Update `setForm(prev => ({...prev, xxx}))` → `setHeader(prev => ({...prev, xxx}))`.
Pass `lines` and `setLines` to `LineItemEditor` instead of `form.lines`.

This is a larger refactor — update all references carefully.

**Step 2: Verify**

Run: `pnpm typecheck`
Expected: PASS

Open form, type in fields, add/remove lines. All should work same as before.

**Step 3: Commit**

```bash
git add src/components/sales/sale-order-form.tsx
git commit -m "refactor(sales): split form state into header and lines for better rendering"
```
