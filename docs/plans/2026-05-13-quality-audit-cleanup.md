# Quality Audit Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce the pasted quality-audit report to zero critical accessibility/correctness issues and eliminate the high-volume architecture/performance warnings without changing product behavior.

**Architecture:** Work category-by-category with small, verifiable frontend-only changes in `apps/web`. Prefer reusable helpers/codemods for repeated patterns (`new Date()` in JSX, Tailwind `w-N h-N`, router method destructuring), and use manual fixes where semantics matter (labels, list keys, `dangerouslySetInnerHTML`). Keep backend/Convex logic untouched unless a type error proves a frontend contract needs adjustment.

**Tech Stack:** Next.js 15, React 19, TypeScript 5.9, Tailwind, shadcn/Radix UI, ESLint, pnpm workspace.

---

### Task 1: Capture baseline and fix the blocking ESLint error

**Files:**
- Modify: `apps/web/src/app/(dashboard)/hr/reports/page.tsx`
- Create: `docs/quality-audit-baseline.md`

**Step 1: Save current verifier outputs**

Run:

```bash
cd /Users/madearga/Desktop/crm
pnpm --filter @crm/web lint | tee /tmp/crm-eslint-baseline.txt
pnpm --filter @crm/web typecheck | tee /tmp/crm-typecheck-baseline.txt
```

Expected: ESLint currently fails with `EmptyState is not defined` in `hr/reports/page.tsx`. Typecheck may also fail on the same missing import.

**Step 2: Write baseline note**

Create `docs/quality-audit-baseline.md` with:

```markdown
# Quality Audit Baseline

Source report from user:
- Accessibility: 51 issues
- Architecture: 727 issues
- Correctness: 138 issues
- Dead Code: 97 issues
- Performance: 89 issues

Local verifier at start:
- `pnpm --filter @crm/web lint`: fails on missing `EmptyState` import in `apps/web/src/app/(dashboard)/hr/reports/page.tsx`
- `pnpm --filter @crm/web typecheck`: record actual result here

Scope:
- Frontend-only cleanup under `apps/web`
- No Convex/backend behavior changes
```

**Step 3: Add missing import**

In `apps/web/src/app/(dashboard)/hr/reports/page.tsx`, add:

```typescript
import { EmptyState } from '@/components/empty-state';
```

Place it with the other component imports.

**Step 4: Verify ESLint no longer has that error**

Run:

```bash
cd /Users/madearga/Desktop/crm
pnpm --filter @crm/web lint
```

Expected: no `react/jsx-no-undef` error for `EmptyState`. Existing hook warnings may remain.

**Step 5: Commit**

```bash
cd /Users/madearga/Desktop/crm
git add docs/quality-audit-baseline.md apps/web/src/app/'(dashboard)'/hr/reports/page.tsx
git commit -m "fix(web): restore missing HR reports empty state import"
```

---

### Task 2: Fix combobox required ARIA props

**Files:**
- Modify: `apps/web/src/components/organization/organization-switcher.tsx`

**Step 1: Add a stable listbox id**

Import `useId` if it is not already imported:

```typescript
import { useId } from 'react';
```

Inside `OrganizationSwitcher`, add:

```typescript
const organizationListId = useId();
```

**Step 2: Connect the combobox to its popup list**

Update the trigger button:

```tsx
<Button
  variant="outline"
  role="combobox"
  aria-controls={organizationListId}
  aria-expanded={open}
  className="w-[240px] justify-between"
  size="sm"
>
```

Update the command list:

```tsx
<CommandList id={organizationListId}>
```

**Step 3: Verify**

Run:

```bash
cd /Users/madearga/Desktop/crm
pnpm --filter @crm/web lint
pnpm --filter @crm/web typecheck
```

Expected: no type errors; pasted audit rule `role-has-required-aria-props` should be resolved for `organization-switcher.tsx:164` when the audit is re-run.

**Step 4: Commit**

```bash
git add apps/web/src/components/organization/organization-switcher.tsx
git commit -m "fix(a11y): connect organization combobox to listbox"
```

---

### Task 3: Fix form labels with associated controls

**Files:**
- Modify first pass: `apps/web/src/components/team/team-invite-link-tab.tsx`
- Then apply same pattern to every file reported by `label-has-associated-control`

**Step 1: Fix native inputs with `htmlFor` + `id`**

For each label next to `<Input>` or `<Textarea>`, use this pattern:

```tsx
<label htmlFor="company-name" className="text-sm font-medium">
  Company name
</label>
<Input id="company-name" ... />
```

Use unique, descriptive ids per form. Do not reuse ids inside mapped rows unless the id includes the row's stable id.

**Step 2: Fix Radix Select labels with `aria-labelledby`**

In `apps/web/src/components/team/team-invite-link-tab.tsx`, replace the first standalone Select label block with:

```tsx
<div className="flex-1 space-y-2">
  <label id="invite-role-label" className="text-sm font-medium">
    Role for new members
  </label>
  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
    <SelectTrigger aria-labelledby="invite-role-label">
      <SelectValue placeholder="Select a role..." />
    </SelectTrigger>
    <SelectContent>
      {templatesList.map((t) => (
        <SelectItem key={t._id} value={t._id}>
          {t.name}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

Replace the expiry block with:

```tsx
<div className="space-y-2">
  <label id="invite-expiry-label" className="text-sm font-medium">
    Expires in
  </label>
  <Select value={selectedExpiry} onValueChange={setSelectedExpiry}>
    <SelectTrigger aria-labelledby="invite-expiry-label" className="w-[140px]">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {EXPIRY_OPTIONS.map((opt) => (
        <SelectItem key={opt.value} value={String(opt.value)}>
          {opt.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

**Step 3: Find all remaining labels**

Run:

```bash
cd /Users/madearga/Desktop/crm
rg -n "<label(?![^>]*(htmlFor|id=))" apps/web/src --glob '*.tsx'
```

Expected: every remaining match is either intentionally decorative or still needs the same fix. Prefer fixing rather than disabling.

**Step 4: Verify**

Run:

```bash
cd /Users/madearga/Desktop/crm
pnpm --filter @crm/web lint
pnpm --filter @crm/web typecheck
```

Expected: no new lint/type errors. Re-run the user's audit command and confirm `Label has associated control ×39` drops to zero.

**Step 5: Commit**

```bash
git add apps/web/src
git commit -m "fix(a11y): associate form labels with controls"
```

---

### Task 4: Remove `autoFocus` from product/search overlays

**Files:**
- Modify first pass: `apps/web/src/components/sales/line-item-editor.tsx`
- Then apply same pattern to every file reported by `no-autofocus`

**Step 1: Remove the flagged attribute**

In `line-item-editor.tsx`, change:

```tsx
<Input
  placeholder="Search products..."
  value={productSearch}
  onChange={(e) => setProductSearch(e.target.value)}
  autoFocus
/>
```

to:

```tsx
<Input
  placeholder="Search products..."
  value={productSearch}
  onChange={(e) => setProductSearch(e.target.value)}
/>
```

**Step 2: Find all remaining autofocus usage**

Run:

```bash
cd /Users/madearga/Desktop/crm
rg -n "autoFocus" apps/web/src --glob '*.tsx'
```

Expected: no remaining `autoFocus` unless the team explicitly accepts a local lint disable. Default is no disables.

**Step 3: Verify and commit**

```bash
pnpm --filter @crm/web lint
pnpm --filter @crm/web typecheck
git add apps/web/src
git commit -m "fix(a11y): remove autofocus from form controls"
```

---

### Task 5: Remove render-time `new Date()` hydration risks

**Files:**
- Create: `apps/web/src/hooks/use-client-date-string.ts`
- Modify first pass: `apps/web/src/app/(dashboard)/companies/page.tsx`
- Then apply same pattern to every file reported by `rendering hydration mismatch time`

**Step 1: Create a client-only date hook**

Create `apps/web/src/hooks/use-client-date-string.ts`:

```typescript
'use client';

import { useEffect, useState } from 'react';

export function useClientDateString(fallback = 'export') {
  const [dateString, setDateString] = useState(fallback);

  useEffect(() => {
    setDateString(new Date().toISOString().split('T')[0]);
  }, []);

  return dateString;
}
```

**Step 2: Replace the companies export filename**

In `apps/web/src/app/(dashboard)/companies/page.tsx`, import the hook:

```typescript
import { useClientDateString } from '@/hooks/use-client-date-string';
```

Inside the component:

```typescript
const exportDate = useClientDateString();
```

Replace:

```tsx
filename={`companies-${new Date().toISOString().split('T')[0]}`}
```

with:

```tsx
filename={`companies-${exportDate}`}
```

**Step 3: Find remaining JSX date usage**

Run:

```bash
cd /Users/madearga/Desktop/crm
rg -n "new Date\(" apps/web/src --glob '*.tsx'
```

For each match reachable from returned JSX, move the value behind `useClientDateString`, `useEffect + useState`, or a server-provided stable value. Keep lazy state initializers only when they are not rendered before hydration.

**Step 4: Verify and commit**

```bash
pnpm --filter @crm/web lint
pnpm --filter @crm/web typecheck
git add apps/web/src
git commit -m "fix(web): avoid render-time date hydration mismatches"
```

---

### Task 6: Replace array index keys with stable keys

**Files:**
- Modify first pass: `apps/web/src/app/(dashboard)/hr/reports/page.tsx`
- Then modify every file reported by `array index as key`

**Step 1: Fix static skeleton lists**

In files with static placeholder arrays, define stable string constants outside the component:

```typescript
const SKELETON_ROWS = ['skeleton-row-1', 'skeleton-row-2', 'skeleton-row-3'] as const;
```

Replace:

```tsx
{[1, 2, 3].map((i) => (
  <div key={i} className="h-12 animate-pulse rounded bg-muted" />
))}
```

with:

```tsx
{SKELETON_ROWS.map((rowId) => (
  <div key={rowId} className="h-12 animate-pulse rounded bg-muted" />
))}
```

**Step 2: Fix editable dynamic rows**

For dynamic lists such as line items, add a stable client id when the row is created:

```typescript
type LineItemDraft = ExistingLineItemType & { clientId: string };

const createLineItemDraft = (): LineItemDraft => ({
  clientId: crypto.randomUUID(),
  productName: '',
  quantity: 1,
  price: 0,
  // keep the existing fields
});
```

Render with:

```tsx
<TableRow key={line.clientId}>
```

Do not use `Math.random()` in render. Generate ids only in event handlers, initializers, or data normalization.

**Step 3: Search for remaining index keys**

Run:

```bash
cd /Users/madearga/Desktop/crm
rg -n "key=\{(i|index)\}" apps/web/src --glob '*.tsx'
```

Expected: no remaining matches except safe false positives documented in code review notes.

**Step 4: Verify and commit**

```bash
pnpm --filter @crm/web lint
pnpm --filter @crm/web typecheck
git add apps/web/src
git commit -m "fix(react): use stable keys for rendered lists"
```

---

### Task 7: Remove `dangerouslySetInnerHTML` from chart styles

**Files:**
- Modify: `apps/web/src/components/ui/chart.tsx`

**Step 1: Build CSS as text without HTML injection**

Add this helper above `ChartStyle`:

```typescript
function buildChartCss(id: string, config: ChartConfig) {
  const colorConfig = Object.entries(config).filter(
    ([, itemConfig]) => itemConfig.theme || itemConfig.color
  );

  if (!colorConfig.length) {
    return '';
  }

  return Object.entries(THEMES)
    .map(([theme, prefix]) => {
      const variables = colorConfig
        .map(([key, itemConfig]) => {
          const color =
            itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ||
            itemConfig.color;
          return color ? `  --color-${key}: ${color};` : null;
        })
        .filter(Boolean)
        .join('\n');

      return `${prefix} [data-chart=${id}] {\n${variables}\n}`;
    })
    .join('\n');
}
```

Replace `ChartStyle` with:

```tsx
const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const css = buildChartCss(id, config);

  if (!css) {
    return null;
  }

  return <style>{css}</style>;
};
```

**Step 2: Verify charts still render**

Run:

```bash
cd /Users/madearga/Desktop/crm
pnpm --filter @crm/web lint
pnpm --filter @crm/web typecheck
```

Expected: no `react/no-danger` warning/error and no chart type errors.

**Step 3: Commit**

```bash
git add apps/web/src/components/ui/chart.tsx
git commit -m "fix(security): avoid raw HTML injection in chart styles"
```

---

### Task 8: Convert stale setState spreads to functional updates

**Files:**
- Modify first pass: `apps/web/src/app/(dashboard)/activities/page.tsx`
- Then modify every file reported by `rerender functional setstate`

**Step 1: Replace object spreads that read stale closure state**

In `activities/page.tsx`, replace patterns like:

```tsx
onChange={(e) => setNewActivity({ ...newActivity, title: e.target.value })}
```

with:

```tsx
onChange={(e) =>
  setNewActivity((prev) => ({ ...prev, title: e.target.value }))
}
```

For Select handlers, replace:

```tsx
onValueChange={(v) => setNewActivity({ ...newActivity, type: v })}
```

with:

```tsx
onValueChange={(v) => setNewActivity((prev) => ({ ...prev, type: v }))}
```

**Step 2: Search for remaining stale spread updates**

Run:

```bash
cd /Users/madearga/Desktop/crm
rg -n "set[A-Z][A-Za-z0-9_]*\(\{ \.\.\.[A-Za-z0-9_]+," apps/web/src --glob '*.tsx'
```

Expected: no remaining direct spread updates where the setter reads the current state variable.

**Step 3: Verify and commit**

```bash
pnpm --filter @crm/web lint
pnpm --filter @crm/web typecheck
git add apps/web/src
git commit -m "perf(react): use functional state updates for form drafts"
```

---

### Task 9: Replace state-only mutation flags with refs

**Files:**
- Modify first pass: `apps/web/src/app/invite/[token]/page.tsx`
- Then modify every file reported by `rerender state only in handlers`

**Step 1: Replace unread state with ref**

In `apps/web/src/app/invite/[token]/page.tsx`, replace:

```typescript
const [joined, setJoined] = useState(false);
```

with:

```typescript
const joinedRef = useRef(false);
```

Update writes:

```typescript
joinedRef.current = true;
```

Remove any `setJoined(...)` calls.

**Step 2: Import `useRef`**

If the file imports React hooks individually, add `useRef` to the import list.

**Step 3: Verify and commit**

```bash
pnpm --filter @crm/web lint
pnpm --filter @crm/web typecheck
git add apps/web/src/app/invite/'[token]'/page.tsx
git commit -m "perf(react): avoid rerender for invite join guard"
```

---

### Task 10: Combine avoidable `.filter().map()` chains on hot forms

**Files:**
- Modify first pass: `apps/web/src/components/sales/sale-order-form.tsx`
- Then modify every file reported by `js combine iterations`

**Step 1: Replace chained iteration with one pass**

For a pattern like:

```typescript
const selected = items
  .filter((item) => item.enabled)
  .map((item) => transform(item));
```

use:

```typescript
const selected = items.reduce<TransformedItem[]>((acc, item) => {
  if (!item.enabled) {
    return acc;
  }

  acc.push(transform(item));
  return acc;
}, []);
```

Use real domain types instead of `TransformedItem`.

**Step 2: Verify behavior**

If the transformed array affects totals or submitted payloads, add or update a focused unit test near the component if a test harness exists. Otherwise manually verify with typecheck and a browser smoke test.

**Step 3: Verify and commit**

```bash
pnpm --filter @crm/web lint
pnpm --filter @crm/web typecheck
git add apps/web/src/components/sales/sale-order-form.tsx
git commit -m "perf(sales): combine derived line item iterations"
```

---

### Task 11: Apply high-volume Tailwind architecture cleanup

**Files:**
- Modify: all `apps/web/src/**/*.tsx` files reported by:
  - `design no redundant size axes`
  - `design no default tailwind palette`

**Step 1: Replace equal width/height utilities with `size-*`**

Examples:

```diff
- <Plus className="mr-1 h-4 w-4" />
+ <Plus className="mr-1 size-4" />

- <Clock className="h-8 w-8 text-yellow-600" />
+ <Clock className="size-8 text-yellow-600" />
```

Run searches:

```bash
cd /Users/madearga/Desktop/crm
rg -n "\b(h|w)-([0-9.]+|px)\b.*\b(w|h)-\2\b" apps/web/src --glob '*.tsx'
rg -n "\bw-([0-9.]+|px)\b.*\bh-\1\b|\bh-([0-9.]+|px)\b.*\bw-\2\b" apps/web/src --glob '*.tsx'
```

Fix matches manually or with a reviewed codemod. Do not change unequal dimensions.

**Step 2: Replace default Tailwind palettes**

Use project-neutral colors first:

```diff
- bg-gray-100
+ bg-muted

- text-gray-500
+ text-muted-foreground

- border-gray-200
+ border-border

- bg-slate-50
+ bg-muted/50
```

For brand/accent colors, prefer existing app tokens (`primary`, `accent`, `destructive`, `muted`) instead of inventing new hex values. If semantic status colors are intentional, keep them (`green`, `red`, `yellow`) unless the audit explicitly reports them.

Search:

```bash
rg -n "\b(bg|text|border|ring|from|to|via)-(gray|slate|indigo)-" apps/web/src --glob '*.tsx'
```

**Step 3: Format**

Run:

```bash
cd /Users/madearga/Desktop/crm
pnpm --filter @crm/web lint:fix
```

Expected: Prettier/Tailwind class ordering is normalized.

**Step 4: Verify and commit**

```bash
pnpm --filter @crm/web lint
pnpm --filter @crm/web typecheck
git add apps/web/src
git commit -m "style(web): align Tailwind utilities with design tokens"
```

---

### Task 12: Destructure router methods for React Compiler clarity

**Files:**
- Modify all `apps/web/src/**/*.tsx` files reported by `react compiler destructure method`

**Step 1: Replace direct router method calls**

Before:

```typescript
const router = useRouter();

router.push('/templates');
router.replace(path);
router.refresh();
```

After:

```typescript
const { push, replace, refresh } = useRouter();

push('/templates');
replace(path);
refresh();
```

Only destructure methods actually used in that file.

**Step 2: Search remaining direct method usage**

Run:

```bash
cd /Users/madearga/Desktop/crm
rg -n "router\.(push|replace|refresh|back|forward|prefetch)" apps/web/src --glob '*.tsx'
```

Expected: no matches in files covered by the audit.

**Step 3: Verify and commit**

```bash
pnpm --filter @crm/web lint
pnpm --filter @crm/web typecheck
git add apps/web/src
git commit -m "refactor(web): destructure router methods"
```

---

### Task 13: Triage dead code without deleting reachable public APIs blindly

**Files:**
- Review files/exports reported by Dead Code audit, especially:
  - `Unused export: usePermission`
  - `Unused type: ShippingAddress`
  - all `Unused file` entries

**Step 1: Confirm each candidate is truly unused**

For each export/file, run both text search and TypeScript-aware checks where possible:

```bash
cd /Users/madearga/Desktop/crm
rg -n "usePermission" . --glob '!node_modules' --glob '!.next'
rg -n "ShippingAddress" . --glob '!node_modules' --glob '!.next'
```

**Step 2: Delete or de-export only after confirmation**

Rules:
- If an unused export is from an internal module and not part of a package public API, remove the export.
- If a file is truly unused and not a route, story, test fixture, or future migration, delete it.
- If an export is intentionally public but unused internally, add a short comment near the barrel export instead of deleting.

**Step 3: Verify and commit**

```bash
pnpm --filter @crm/web lint
pnpm --filter @crm/web typecheck
pnpm test
git add -A
git commit -m "chore(web): remove confirmed dead code"
```

---

### Task 14: Final audit verification and cleanup

**Files:**
- Modify: `docs/quality-audit-baseline.md`

**Step 1: Run standard verifiers**

```bash
cd /Users/madearga/Desktop/crm
pnpm --filter @crm/web lint
pnpm --filter @crm/web typecheck
pnpm test
```

Expected: all pass, or only explicitly accepted warnings remain documented.

**Step 2: Re-run the audit command that produced the pasted report**

Use the exact command/tool that generated the categories:

```bash
# Replace with the actual command used for the pasted report, then paste results into docs/quality-audit-baseline.md
<quality-audit-command> | tee /tmp/crm-quality-audit-final.txt
```

Expected:
- Accessibility: 0 critical issues; target 0 total if feasible
- Correctness: 0 `hydration mismatch time`, 0 `array index as key`, 0 `dangerouslySetInnerHTML`
- Performance: 0 reported stale setState/ref/combine-iteration items
- Architecture: `size-*`, palette, and router-method warnings eliminated or documented
- Dead Code: confirmed removals complete; any retained public APIs documented

**Step 3: Update final notes**

Append to `docs/quality-audit-baseline.md`:

```markdown
## Final Verification

- `pnpm --filter @crm/web lint`: PASS
- `pnpm --filter @crm/web typecheck`: PASS
- `pnpm test`: PASS
- Quality audit: [paste summary]

Intentional remaining warnings:
- None / list with rationale
```

**Step 4: Final commit**

```bash
git add docs/quality-audit-baseline.md
git commit -m "docs: record quality audit cleanup results"
```
