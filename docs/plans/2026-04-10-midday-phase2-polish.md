# Midday-Inspired CRM Polish — Phase 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 4 high-impact UX patterns from Midday: floating selection bar, Zustand table store, contextual empty states, and Cmd+K global search command palette.

**Architecture:** Add `zustand` for table selection state (persists across page navigations), `cmdk` for command palette (lightweight, shadcn already uses it), and `framer-motion` for animated floating bar. All four features are independent frontend-only changes — no Convex schema changes needed.

**Tech Stack:** zustand (new), cmdk (new), framer-motion (new), TanStack Table (existing), nuqs (existing), Convex hooks (existing)

---

## Prerequisites: Install Dependencies

**Step 1: Install packages**

Run:
```bash
cd apps/web && bun add zustand cmdk framer-motion
```

**Step 2: Commit**

```bash
git add apps/web/package.json apps/web/bun.lock
git commit -m "chore: add zustand, cmdk, framer-motion dependencies"
```

---

## Task 1: Zustand Table Store

**Files:**
- Create: `apps/web/src/store/table-store.ts`

**Why:** Currently `selectedIds` is local `useState` per page — lost on navigation. Midday uses Zustand so selection persists when you navigate to a detail page and back. Also enables the floating bar to read state from the store.

**Step 1: Create the store**

Create `apps/web/src/store/table-store.ts`:

```ts
import { create } from "zustand";

type TableId = "companies" | "contacts";

interface TableState {
  // Per-table selection state
  selections: Record<TableId, Set<string>>;
  toggleOne: (tableId: TableId, id: string) => void;
  toggleAll: (tableId: TableId, allIds: string[]) => void;
  clearSelection: (tableId: TableId) => void;
  getSelectedIds: (tableId: TableId) => Set<string>;
}

export const useTableStore = create<TableState>((set, get) => ({
  selections: {
    companies: new Set(),
    contacts: new Set(),
  },

  toggleOne: (tableId, id) =>
    set((state) => {
      const next = new Set(state.selections[tableId]);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return {
        selections: { ...state.selections, [tableId]: next },
      };
    }),

  toggleAll: (tableId, allIds) =>
    set((state) => {
      const current = state.selections[tableId];
      const allSelected = allIds.length > 0 && allIds.every((id) => current.has(id));
      return {
        selections: {
          ...state.selections,
          [tableId]: allSelected ? new Set() : new Set(allIds),
        },
      };
    }),

  clearSelection: (tableId) =>
    set((state) => ({
      selections: { ...state.selections, [tableId]: new Set() },
    })),

  getSelectedIds: (tableId) => get().selections[tableId],
}));
```

**Step 2: Verify typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/web/src/store/
git commit -m "feat: Zustand table store for persistent row selection"
```

---

## Task 2: Animated Floating Selection Bar

**Files:**
- Create: `apps/web/src/components/floating-selection-bar.tsx`
- Modify: `apps/web/src/app/(dashboard)/companies/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/contacts/page.tsx`

**Why:** Midday uses a fixed floating bar (bottom-center) with blur backdrop that slides up when rows are selected. Much more visible than our current inline bulk actions bar.

**Step 1: Create the floating bar component**

Create `apps/web/src/components/floating-selection-bar.tsx`:

```tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X, Archive, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FloatingSelectionBarProps {
  count: number;
  onClear: () => void;
  onArchive: () => void;
  onRestore?: () => void;
  showRestore?: boolean;
  isArchiving?: boolean;
}

export function FloatingSelectionBar({
  count,
  onClear,
  onArchive,
  onRestore,
  showRestore,
  isArchiving,
}: FloatingSelectionBarProps) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          className="fixed bottom-6 left-0 right-0 z-50 flex justify-center pointer-events-none"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <div className="relative pointer-events-auto min-w-[340px]">
            {/* Blur backdrop */}
            <div className="absolute inset-0 rounded-xl border bg-background/80 backdrop-blur-lg shadow-lg" />
            <div className="relative flex h-12 items-center justify-between pl-4 pr-2">
              <span className="text-sm font-medium">
                {count} {count === 1 ? "item" : "items"} selected
              </span>
              <div className="flex items-center gap-2">
                {showRestore && onRestore && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRestore}
                    disabled={isArchiving}
                  >
                    <RotateCcw className="mr-1 h-3.5 w-3.5" />
                    Restore
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={onArchive} disabled={isArchiving}>
                  <Archive className="mr-1 h-3.5 w-3.5" />
                  Archive
                </Button>
                <Button variant="ghost" size="sm" onClick={onClear}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

**Step 2: Integrate into Companies page**

In `apps/web/src/app/(dashboard)/companies/page.tsx`:

1. Replace local `selectedIds` useState with `useTableStore`:
   ```ts
   import { useTableStore } from "@/store/table-store";
   // ...
   const { selections, toggleOne, toggleAll, clearSelection } = useTableStore();
   const selectedIds = selections.companies;
   ```

2. Remove the inline `{selectedIds.size > 0 && ...}` bulk actions `<div>`.

3. Add `<FloatingSelectionBar>` at the bottom of the return JSX:
   ```tsx
   <FloatingSelectionBar
     count={selectedIds.size}
     onClear={() => clearSelection("companies")}
     onArchive={handleBulkArchive}
     onRestore={handleBulkRestore}
     showRestore={showArchived}
     isArchiving={archiveCompany.isPending}
   />
   ```

4. Update `getColumns` call to pass store functions:
   ```ts
   const columns = useMemo(
     () => getColumns({
       selectedIds,
       toggleOne: (id) => toggleOne("companies", id),
       allIds,
       toggleAll: () => toggleAll("companies", allIds),
     }),
     [selectedIds, toggleOne, allIds, toggleAll],
   );
   ```

**Step 3: Same integration for Contacts page**

Mirror the same changes as Companies, using tableId `"contacts"`.

**Step 4: Verify typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: PASS

**Step 5: Browser test**

1. Open `http://localhost:3005/companies`
2. Select a row → floating bar should slide up from bottom
3. Click archive → items archived, bar slides away
4. Select all → count shows correctly
5. Click clear → bar slides away
6. Navigate to `/contacts` and back to `/companies` → selection should be gone (cleared on action)

**Step 6: Commit**

```bash
git add apps/web/src/components/floating-selection-bar.tsx apps/web/src/app/\(dashboard\)/companies/page.tsx apps/web/src/app/\(dashboard\)/contacts/page.tsx apps/web/src/store/table-store.ts
git commit -m "feat: animated floating selection bar + Zustand table store"
```

---

## Task 3: Contextual Empty States (No Data vs No Results)

**Files:**
- Modify: `apps/web/src/components/empty-state.tsx`
- Create: `apps/web/src/components/no-results.tsx`
- Modify: `apps/web/src/app/(dashboard)/companies/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/contacts/page.tsx`

**Why:** Midday has two empty states: "No invoices" (zero data) and "No results" (search returned nothing). Currently we only show one.

**Step 1: Create NoResults component**

Create `apps/web/src/components/no-results.tsx`:

```tsx
"use client";

import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NoResultsProps {
  searchQuery: string;
  onClear: () => void;
}

export function NoResults({ searchQuery, onClear }: NoResultsProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
        <SearchX className="size-7" />
      </div>
      <h3 className="mt-6 text-sm font-semibold">No results found</h3>
      <p className="mt-1 max-w-[260px] text-center text-sm text-muted-foreground">
        No items matching &ldquo;{searchQuery}&rdquo;. Try a different search or clear filters.
      </p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onClear}>
        Clear search
      </Button>
    </div>
  );
}
```

**Step 2: Integrate into Companies page**

Replace the current empty state logic:

```tsx
// BEFORE (single empty state):
{!rows.length ? (
  <EmptyState ... />
) : (...)}

// AFTER (two empty states):
{isLoading ? (
  <DataTableSkeleton ... />
) : search && !rows.length ? (
  <NoResults searchQuery={search} onClear={() => setSearch("")} />
) : !rows.length ? (
  <EmptyState ... />
) : (
  <DataTable ... />
)}
```

The key change: if `search` is truthy and `rows` is empty, show `NoResults` (with the search term and clear button). If `search` is falsy and `rows` is empty, show `EmptyState` (the "no data yet" version).

**Step 3: Same for Contacts page**

Identical pattern, using contacts-specific empty state.

**Step 4: Verify typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: PASS

**Step 5: Browser test**

1. Open `/companies` with no search → see "No companies yet" (if empty) or table
2. Type "xyz123" in search → see "No results found for 'xyz123'" with Clear button
3. Click Clear → search cleared, back to table or "No companies yet"

**Step 6: Commit**

```bash
git add apps/web/src/components/no-results.tsx apps/web/src/app/\(dashboard\)/companies/page.tsx apps/web/src/app/\(dashboard\)/contacts/page.tsx
git commit -m "feat: contextual empty states (no data vs no results)"
```

---

## Task 4: Cmd+K Global Search Command Palette

**Files:**
- Create: `apps/web/src/components/command-palette.tsx`
- Modify: `apps/web/src/app/(dashboard)/layout.tsx`
- Modify: `apps/web/src/components/keyboard-shortcuts.tsx`

**Why:** Midday doesn't have this specific feature, but it's the #1 requested productivity feature in CRMs. Users press Cmd+K, type a name, see matching companies/contacts/deals, click to navigate.

**Step 1: Create a Convex search query**

Create `convex/search.ts`:

```ts
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { z } from "zod";
import { zid } from "./validation";
import { createOrgQuery } from "./functions";

export const globalSearch = createOrgQuery()({
  args: {
    query: z.string().min(1).max(100),
  },
  returns: z.object({
    companies: z.array(z.object({
      id: zid("companies"),
      name: z.string(),
      industry: z.string().optional(),
    })),
    contacts: z.array(z.object({
      id: zid("contacts"),
      fullName: z.string(),
      email: z.string(),
    })),
    deals: z.array(z.object({
      id: zid("deals"),
      title: z.string(),
      stage: z.string(),
    })),
  }),
  handler: async (ctx, args) => {
    const { orgId } = ctx;
    const query = args.query.toLowerCase();

    const [companies, contacts, deals] = await Promise.all([
      ctx.table("companies")
        .filter((q: any) => q.eq(q.field("organizationId"), orgId))
        .filter((q: any) =>
          q.or(
            q.gte(q.field("name_lower"), query),
            q.like(q.field("name"), `%${query}%`),
          )
        )
        .take(5)
        .toArray(),
      ctx.table("contacts")
        .filter((q: any) => q.eq(q.field("organizationId"), orgId))
        .filter((q: any) =>
          q.or(
            q.gte(q.field("fullName_lower"), query),
            q.like(q.field("fullName"), `%${query}%`),
            q.like(q.field("email"), `%${query}%`),
          )
        )
        .take(5)
        .toArray(),
      ctx.table("deals")
        .filter((q: any) => q.eq(q.field("organizationId"), orgId))
        .filter((q: any) =>
          q.or(
            q.gte(q.field("title_lower"), query),
            q.like(q.field("title"), `%${query}%`),
          )
        )
        .take(5)
        .toArray(),
    ]);

    return {
      companies: companies.map((c: any) => ({
        id: c._id || c.id,
        name: c.name,
        industry: c.industry,
      })),
      contacts: contacts.map((c: any) => ({
        id: c._id || c.id,
        fullName: c.fullName,
        email: c.email,
      })),
      deals: deals.map((d: any) => ({
        id: d._id || d.id,
        title: d.title,
        stage: d.stage,
      })),
    };
  },
});
```

> **IMPORTANT NOTE:** The filter implementation above may need adjustment based on Convex's actual filter API. Convex ents uses `q.field()` for field references. If `q.like()` is not available, use `q.gte()` with a prefix match approach or use the existing `search` parameter pattern from `companies/list` and `contacts/list` queries. Check the existing search implementation in `convex/companies.ts` and `convex/contacts.ts` for the correct pattern, then replicate it here as a cross-entity search.

**Alternative approach (safer):** Instead of a new query, call the existing `list` queries in parallel with the search term:

```ts
handler: async (ctx, args) => {
  // Reuse existing list queries internally
  // ... call companies.list, contacts.list, deals.list with search
  // ... take first 5 of each
  // ... return merged results
}
```

**Step 2: Create the command palette component**

Create `apps/web/src/components/command-palette.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthQuery } from "@/lib/convex/hooks";
import { api } from "@convex/_generated/api";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Building2,
  Users,
  Handshake,
  LayoutDashboard,
  Settings,
  Activity,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Companies", href: "/companies", icon: Building2 },
  { label: "Contacts", href: "/contacts", icon: Users },
  { label: "Deals", href: "/deals", icon: Handshake },
  { label: "Activities", href: "/activities", icon: Activity },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  // Search across all entities when query is non-empty
  const { data: searchResults } = useAuthQuery(
    api.search.globalSearch,
    query.length >= 2 ? { query } : "skip",
  );

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = useCallback(
    (command: () => void) => {
      setOpen(false);
      command();
    },
    [],
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search companies, contacts, deals..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Search results */}
        {searchResults && searchResults.companies.length > 0 && (
          <CommandGroup heading="Companies">
            {searchResults.companies.map((company) => (
              <CommandItem
                key={company.id}
                value={`company-${company.name}`}
                onSelect={() => runCommand(() => router.push(`/companies/${company.id}`))}
              >
                <Building2 className="mr-2 h-4 w-4" />
                <span>{company.name}</span>
                {company.industry && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {company.industry}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {searchResults && searchResults.contacts.length > 0 && (
          <CommandGroup heading="Contacts">
            {searchResults.contacts.map((contact) => (
              <CommandItem
                key={contact.id}
                value={`contact-${contact.fullName}`}
                onSelect={() => runCommand(() => router.push(`/contacts/${contact.id}`))}
              >
                <Users className="mr-2 h-4 w-4" />
                <span>{contact.fullName}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {contact.email}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {searchResults && searchResults.deals.length > 0 && (
          <CommandGroup heading="Deals">
            {searchResults.deals.map((deal) => (
              <CommandItem
                key={deal.id}
                value={`deal-${deal.title}`}
                onSelect={() => runCommand(() => router.push(`/deals/${deal.id}`))}
              >
                <Handshake className="mr-2 h-4 w-4" />
                <span>{deal.title}</span>
                <span className="ml-2 text-xs text-muted-foreground capitalize">
                  {deal.stage}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Navigation */}
        {(query.length < 2 || !searchResults) && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Navigation">
              {NAV_ITEMS.map((item) => (
                <CommandItem
                  key={item.href}
                  value={`nav-${item.label}`}
                  onSelect={() => runCommand(() => router.push(item.href))}
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  <span>{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
```

**Step 3: Check if shadcn Command component exists**

Run: `ls apps/web/src/components/ui/command.tsx`

If it doesn't exist, install it:
```bash
cd apps/web && bunx shadcn@latest add command
```

**Step 4: Add CommandPalette to layout**

In `apps/web/src/app/(dashboard)/layout.tsx`, add:

```tsx
import { CommandPalette } from '@/components/command-palette';
// ... in the JSX, after <KeyboardShortcuts />:
<CommandPalette />
```

**Step 5: Update keyboard shortcuts**

In `apps/web/src/components/keyboard-shortcuts.tsx`, add to SHORTCUTS array:

```ts
{ keys: ['⌘', 'K'], action: 'Open search', href: null },
```

**Step 6: Verify typecheck**

Run: `cd apps/web && npx tsc --noEmit`

If the search query has issues, check the existing `list` queries in `convex/companies.ts` and `convex/contacts.ts` to see how search is implemented there. Adapt the same pattern for the cross-entity search.

**Step 7: Browser test**

1. Press Cmd+K → command palette opens
2. Type "Tech" → see matching companies, contacts, deals
3. Click a result → navigates to detail page
4. Press Esc → palette closes
5. Without typing, see navigation items

**Step 8: Commit**

```bash
git add convex/search.ts apps/web/src/components/command-palette.tsx apps/web/src/components/keyboard-shortcuts.tsx apps/web/src/app/\(dashboard\)/layout.tsx apps/web/src/components/ui/command.tsx
git commit -m "feat: Cmd+K global search command palette"
```

---

## Summary

| Task | Description | Dependencies | Effort |
|------|-------------|--------------|--------|
| Prereq | Install zustand, cmdk, framer-motion | None | 2 min |
| 1 | Zustand table store | Prereq | 10 min |
| 2 | Floating selection bar + integrate store | Task 1 | 30 min |
| 3 | Contextual empty states | None | 15 min |
| 4 | Cmd+K command palette | Prereq | 45 min |

**Total: ~100 minutes**

**New dependencies:** `zustand`, `cmdk`, `framer-motion`

**No Convex schema changes** — Task 4 adds a new query file but no table changes.

**After completion:** CRM will have a polished UX matching Midday's production quality — animated selection bar, persistent selection state, smart empty states, and lightning-fast global search.
