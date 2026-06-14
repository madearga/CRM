# React Performance Optimization Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce initial JS bundle by ~350KB+ through dynamic imports, replacing date-fns with Intl API, and adding Suspense boundaries — without changing any user-facing behavior.

**Architecture:** Incremental changes — each task is independently deployable and verifiable. Dynamic imports lazy-load heavy components; Intl API replaces date-fns for simple formatting; Suspense enables streaming.

**Tech Stack:** Next.js dynamic imports, React Suspense, Intl.DateTimeFormat/RelativeTimeFormat, recharts, date-fns.

---

### Task 1: Dynamic Import Recharts (~200KB savings)

**Files:**
- Modify: `apps/web/src/app/(dashboard)/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/pipeline-chart.tsx`

**Step 1: Check current recharts import in dashboard page**

Run: `head -40 apps/web/src/app/\(dashboard\)/page.tsx`

The dashboard page imports `recharts` directly (`Bar`, `BarChart`, etc.) and also imports `pipeline-chart.tsx` which uses recharts.

**Step 2: Dynamic import PipelineChart in dashboard page**

Find the import of `pipeline-chart` or `PipelineChart` in `apps/web/src/app/(dashboard)/page.tsx`. Replace the static import with:

```tsx
const PipelineChart = dynamic(() => import('./pipeline-chart'), {
  ssr: false,
  loading: () => <div className="h-[300px] animate-pulse rounded-lg bg-muted" />,
});
```

Remove the static `import { PipelineChart } from './pipeline-chart'` or similar.

**Step 3: Verify recharts is no longer in the initial bundle**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | tail -5`

Expected: 0 errors.

**Step 4: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/page.tsx
git commit -m "perf: dynamic import PipelineChart to lazy-load recharts (~200KB)"
```

---

### Task 2: Replace date-fns with Intl API (~70KB savings)

**Files:**
- Create: `apps/web/src/lib/format-date.ts`
- Modify: `apps/web/src/app/(dashboard)/contacts/[id]/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/deals/[id]/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/activities/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/companies/[id]/page.tsx`
- Modify: `apps/web/src/components/activities/activity-timeline.tsx`

**Step 1: Create format-date utility**

Create `apps/web/src/lib/format-date.ts`:

```ts
/**
 * Lightweight date formatting using native Intl API.
 * Replaces date-fns format() and formatDistanceToNow().
 */

const relativeTimeFormatter = new Intl.RelativeTimeFormat('en', {
  numeric: 'auto',
  style: 'long',
});

const DIVISIONS: { amount: number; name: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, name: 'seconds' },
  { amount: 60, name: 'minutes' },
  { amount: 24, name: 'hours' },
  { amount: 7, name: 'days' },
  { amount: 4.34524, name: 'weeks' },
  { amount: 12, name: 'months' },
  { amount: Number.POSITIVE_INFINITY, name: 'years' },
];

/** Format a date relative to now, e.g. "3 hours ago", "in 2 days" */
export function formatDistanceToNow(date: Date | number): string {
  const timestamp = typeof date === 'number' ? date : date.getTime();
  const now = Date.now();
  let diff = (timestamp - now) / 1000;

  for (const division of DIVISIONS) {
    if (Math.abs(diff) < division.amount) {
      return relativeTimeFormatter.format(
        Math.round(diff),
        division.name
      );
    }
    diff /= division.amount;
  }
  return relativeTimeFormatter.format(Math.round(diff), 'years');
}

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

/** Format a date with a pattern. Supports common date-fns patterns:
 *  'MMM d, yyyy' → "Jan 15, 2026"
 *  'dd MMM yyyy' → "15 Jan 2026"
 *  'yyyy-MM-dd' → "2026-01-15"
 */
export function format(date: Date | number, pattern: string): string {
  const d = typeof date === 'number' ? new Date(date) : date;

  if (!dateFormatters.has(pattern)) {
    const options = patternToOptions(pattern);
    dateFormatters.set(pattern, new Intl.DateTimeFormat('en', options));
  }

  return dateFormatters.get(pattern)!.format(d);
}

function patternToOptions(pattern: string): Intl.DateTimeFormatOptions {
  const opts: Intl.DateTimeFormatOptions = {};

  if (pattern.includes('MMM') || pattern.includes('MMMM')) {
    opts.month = pattern.includes('MMMM') ? 'long' : 'short';
  } else if (pattern.includes('MM') || pattern.includes('dd')) {
    opts.month = '2-digit';
  } else if (pattern.includes('M')) {
    opts.month = 'numeric';
  }

  if (pattern.includes('yyyy') || pattern.includes('YYYY')) {
    opts.year = 'numeric';
  } else if (pattern.includes('yy') || pattern.includes('YY')) {
    opts.year = '2-digit';
  }

  if (pattern.includes('dd') || pattern.includes('DD')) {
    opts.day = '2-digit';
  } else if (pattern.includes('d') || pattern.includes('D')) {
    opts.day = 'numeric';
  }

  return opts;
}
```

**Step 2: Replace date-fns imports in each file**

For each file that imports from `'date-fns'`, replace:

```tsx
// BEFORE
import { formatDistanceToNow } from 'date-fns';
import { format } from 'date-fns';

// AFTER
import { formatDistanceToNow, format } from '@/lib/format-date';
```

Files to update:
1. `apps/web/src/app/(dashboard)/contacts/[id]/page.tsx` — uses `formatDistanceToNow`
2. `apps/web/src/app/(dashboard)/deals/[id]/page.tsx` — uses `format(date, 'MMM d, yyyy')`
3. `apps/web/src/app/(dashboard)/activities/page.tsx` — uses `formatDistanceToNow` + `format`
4. `apps/web/src/app/(dashboard)/companies/[id]/page.tsx` — uses `formatDistanceToNow`
5. `apps/web/src/app/(dashboard)/page.tsx` — uses `formatDistanceToNow` + `format`
6. `apps/web/src/components/activities/activity-timeline.tsx` — uses `format`

**Important:** Verify each usage site matches the function signatures. `formatDistanceToNow` is called with `(new Date(timestamp), { addSuffix: true })` — the new version ignores the options object (suffix is built-in to `Intl.RelativeTimeFormat`). Keep the call syntax compatible:

```tsx
// BEFORE
formatDistanceToNow(new Date(activity._creationTime), { addSuffix: true })

// AFTER — the function already includes suffix
formatDistanceToNow(new Date(activity._creationTime))
```

**Step 3: Verify typecheck + rendering**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | tail -10`

Expected: 0 errors.

**Step 4: Commit**

```bash
git add apps/web/src/lib/format-date.ts apps/web/src/app apps/web/src/components/activities/activity-timeline.tsx
git commit -m "perf: replace date-fns with native Intl API (~70KB savings)"
```

---

### Task 3: Dynamic Import Heavy Form Components (~100KB+ savings)

**Files:**
- Modify: `apps/web/src/app/(dashboard)/sales/new/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/sales/[id]/edit/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/invoices/new/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/invoices/[id]/edit/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/templates/new/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/templates/[id]/edit/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/products/[id]/page.tsx`

**Step 1: Update each page to dynamic import its heavy form component**

For each page, replace static import with dynamic:

**`sales/new/page.tsx`:**
```tsx
// BEFORE
import { SaleOrderForm } from '@/components/sales/sale-order-form';
export default function NewSalePage() {
  return <SaleOrderForm />;
}

// AFTER
import dynamic from 'next/dynamic';
const SaleOrderForm = dynamic(() => import('@/components/sales/sale-order-form').then(m => ({ default: m.SaleOrderForm })), {
  loading: () => <div className="flex items-center justify-center py-16"><div className="animate-pulse text-muted-foreground">Loading form...</div></div>,
});
export default function NewSalePage() {
  return <SaleOrderForm />;
}
```

**`sales/[id]/edit/page.tsx`:**
Same pattern — dynamic import `SaleOrderForm`.

**`invoices/new/page.tsx`:**
```tsx
import dynamic from 'next/dynamic';
const InvoiceForm = dynamic(() => import('@/components/invoices/invoice-form').then(m => ({ default: m.InvoiceForm })), {
  loading: () => <div className="flex items-center justify-center py-16"><div className="animate-pulse text-muted-foreground">Loading form...</div></div>,
});
```

**`invoices/[id]/edit/page.tsx`:**
Same pattern — dynamic import `InvoiceForm`.

**`templates/new/page.tsx`:**
```tsx
import dynamic from 'next/dynamic';
const TemplateForm = dynamic(() => import('@/components/templates/template-form').then(m => ({ default: m.TemplateForm })), {
  loading: () => <div className="flex items-center justify-center py-16"><div className="animate-pulse text-muted-foreground">Loading form...</div></div>,
});
```

**`templates/[id]/edit/page.tsx`:**
Same pattern — dynamic import `TemplateForm`.

**`products/[id]/page.tsx`:**
```tsx
import dynamic from 'next/dynamic';
const VariantManager = dynamic(() => import('@/components/products/variant-manager').then(m => ({ default: m.VariantManager })), {
  loading: () => <div className="h-48 animate-pulse rounded-lg bg-muted" />,
});
```

**Step 2: Verify typecheck**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | tail -10`

Expected: 0 errors.

**Step 3: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/sales apps/web/src/app/\(dashboard\)/invoices apps/web/src/app/\(dashboard\)/templates apps/web/src/app/\(dashboard\)/products
git commit -m "perf: dynamic import heavy form components (SaleOrderForm, InvoiceForm, TemplateForm, VariantManager)"
```

---

### Task 4: Add Suspense Boundaries

**Files:**
- Modify: `apps/web/src/app/(dashboard)/layout.tsx`

**Step 1: Add Suspense wrapper around children in dashboard layout**

The dashboard layout is currently `'use client'` and renders `{children}` directly in `<main>`. Wrap with Suspense:

Find in the layout:
```tsx
<main className="flex-1 p-4">{children}</main>
```

Replace with:
```tsx
<main className="flex-1 p-4">
  <React.Suspense fallback={<div className="flex items-center justify-center py-16"><div className="animate-pulse text-muted-foreground">Loading...</div></div>}>
    {children}
  </React.Suspense>
</main>
```

Also add `import React from 'react'` if not already imported (it usually is implicitly in Next.js, but explicit is safer for Suspense usage).

**Step 2: Verify typecheck**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | tail -5`

Expected: 0 errors.

**Step 3: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/layout.tsx
git commit -m "perf: add Suspense boundary in dashboard layout for streaming"
```

---

### Task 5: Remove date-fns Dependency

**Files:**
- Modify: `apps/web/package.json` (or `package.json` at root if monorepo)

**Step 1: Verify no remaining date-fns imports**

Run: `grep -rn "from 'date-fns'" apps/web/src/ --include="*.tsx" --include="*.ts"`

Expected: 0 results (all replaced by Task 2).

If any remain, replace them first using the same `@/lib/format-date` utility.

**Step 2: Remove date-fns from package.json**

Run: `cd apps/web && npm uninstall date-fns`

Or if it's a root dependency:
```bash
npm uninstall date-fns
```

**Step 3: Verify build still works**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | tail -5`

Expected: 0 errors.

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove date-fns dependency (replaced by Intl API)"
```

---

### Task 6: Verify — Build + Bundle Size Check

**Files:**
- No new files

**Step 1: Run full build**

Run: `cd apps/web && npm run build 2>&1 | tail -30`

Expected: Build succeeds. Check for reduced chunk sizes.

**Step 2: Run tests**

Run: `npx convex test 2>&1 | tail -10`

Expected: All tests pass.

**Step 3: Compare bundle sizes (optional but recommended)**

Before/after comparison — recharts and date-fns should appear in lazy chunks, not the main bundle.

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: bundle optimization verification fixes"
```

---

## File Summary

| Action | File | Purpose |
|--------|------|---------|
| Create | `apps/web/src/lib/format-date.ts` | Intl-based date formatting (replaces date-fns) |
| Modify | `apps/web/src/app/(dashboard)/page.tsx` | Dynamic import PipelineChart |
| Modify | `apps/web/src/app/(dashboard)/contacts/[id]/page.tsx` | Replace date-fns |
| Modify | `apps/web/src/app/(dashboard)/deals/[id]/page.tsx` | Replace date-fns |
| Modify | `apps/web/src/app/(dashboard)/activities/page.tsx` | Replace date-fns |
| Modify | `apps/web/src/app/(dashboard)/companies/[id]/page.tsx` | Replace date-fns |
| Modify | `apps/web/src/components/activities/activity-timeline.tsx` | Replace date-fns |
| Modify | `apps/web/src/app/(dashboard)/sales/new/page.tsx` | Dynamic import SaleOrderForm |
| Modify | `apps/web/src/app/(dashboard)/sales/[id]/edit/page.tsx` | Dynamic import SaleOrderForm |
| Modify | `apps/web/src/app/(dashboard)/invoices/new/page.tsx` | Dynamic import InvoiceForm |
| Modify | `apps/web/src/app/(dashboard)/invoices/[id]/edit/page.tsx` | Dynamic import InvoiceForm |
| Modify | `apps/web/src/app/(dashboard)/templates/new/page.tsx` | Dynamic import TemplateForm |
| Modify | `apps/web/src/app/(dashboard)/templates/[id]/edit/page.tsx` | Dynamic import TemplateForm |
| Modify | `apps/web/src/app/(dashboard)/products/[id]/page.tsx` | Dynamic import VariantManager |
| Modify | `apps/web/src/app/(dashboard)/layout.tsx` | Add Suspense boundary |
| Modify | `apps/web/package.json` | Remove date-fns dependency |

## Estimated Savings

| Optimization | Savings | Effort |
|-------------|---------|--------|
| Dynamic import recharts | ~200KB | Small |
| Replace date-fns with Intl | ~70KB | Medium |
| Dynamic import forms | ~100KB+ | Small |
| Suspense boundaries | 0KB (UX improvement) | Small |
| Remove date-fns dep | -70KB from node_modules | Small |
| **Total estimated** | **~370KB+** | — |

## Key Principles
- Each task independently deployable
- Zero user-facing behavior changes
- Progressive enhancement — if dynamic import fails, loading state shows
- `ssr: false` only for recharts (browser-only rendering)
