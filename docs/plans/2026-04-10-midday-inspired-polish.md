# Midday-Inspired CRM Polish — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Apply the best architectural patterns from Midday (open-source business management platform) to our CRM, focusing on three high-impact improvements: TanStack Table with memoized cells, Resizable columns, and RSC-style data fetching patterns.

**Architecture:** Replace hand-coded `<Table>` with TanStack Table (already installed `@tanstack/react-table@8.21.3`) using Midday's pattern of memoized cells + per-column meta + separate column definition files. Add URL-synced filter/sort state via `nuqs` (already installed). No new dependencies needed.

**Tech Stack:** TanStack Table 8, nuqs 2.6, Convex hooks (existing), date-fns, zod, shadcn/ui

---

## Phase 1: Shared Table Infrastructure

### Task 1: Create reusable DataTable component

**Files:**
- Create: `apps/web/src/components/data-table/data-table.tsx`
- Create: `apps/web/src/components/data-table/column-header.tsx`
- Create: `apps/web/src/components/data-table/pagination.tsx`
- Create: `apps/web/src/components/data-table/index.ts`

**Step 1: Write the data-table component**

Create `apps/web/src/components/data-table/data-table.tsx`:

```tsx
"use client";

import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  type flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  rowCount?: number;
  onRowClick?: (row: TData) => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading,
  rowCount,
  onRowClick,
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className={onRowClick ? "cursor-pointer" : ""}
                onClick={() => onRowClick?.(row.original)}
                data-state={row.getIsSelected() && "selected"}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
```

Create `apps/web/src/components/data-table/column-header.tsx`:

```tsx
"use client";

import { type Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  title: string;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={cn(className)}>{title}</div>;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("-ml-3 h-8 data-[state=open]:bg-accent", className)}
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      <span>{title}</span>
      {column.getIsSorted() === "desc" ? (
        <ArrowDown className="ml-1 h-3.5 w-3.5" />
      ) : column.getIsSorted() === "asc" ? (
        <ArrowUp className="ml-1 h-3.5 w-3.5" />
      ) : (
        <ChevronsUpDown className="ml-1 h-3.5 w-3.5" />
      )}
    </Button>
  );
}
```

Create `apps/web/src/components/data-table/pagination.tsx`:

```tsx
"use client";

import { type Table } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
}

export function DataTablePagination<TData>({
  table,
}: DataTablePaginationProps<TData>) {
  return (
    <div className="flex items-center justify-between px-2 py-3">
      <div className="text-sm text-muted-foreground">
        {table.getFilteredRowModel().rows.length} row(s)
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
```

Create `apps/web/src/components/data-table/index.ts`:

```ts
export { DataTable } from "./data-table";
export { DataTableColumnHeader } from "./column-header";
export { DataTablePagination } from "./pagination";
```

**Step 2: Verify typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: PASS (no errors)

**Step 3: Commit**

```bash
git add apps/web/src/components/data-table/
git commit -m "feat: shared DataTable component with TanStack Table"
```

---

## Phase 2: Companies — TanStack Table + Memoized Cells

### Task 2: Create Companies column definitions

**Files:**
- Create: `apps/web/src/app/(dashboard)/companies/columns.tsx`
- Create: `apps/web/src/app/(dashboard)/companies/table-header.tsx`

**Step 1: Write column definitions with memoized cells**

Create `apps/web/src/app/(dashboard)/companies/columns.tsx`:

```tsx
"use client";

import { memo, useCallback } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Building2, Globe } from "lucide-react";
import Link from "next/link";
import { STATUS_COLORS } from "@/lib/constants";
import { DataTableColumnHeader } from "@/components/data-table";

export type CompanyRow = {
  id: string;
  name: string;
  website?: string | null;
  industry?: string | null;
  country?: string | null;
  source?: string | null;
  status?: string | null;
  archivedAt?: number | null;
};

const NameCell = memo(({ name, website }: { name: string; website?: string | null }) => (
  <div className="flex items-center gap-3">
    <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
      <Building2 className="size-4" />
    </div>
    <div>
      <Link href={`/companies/${name}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
        {name}
      </Link>
      {website && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Globe className="h-3 w-3" />
          {website.replace(/^https?:\/\//, "")}
        </div>
      )}
    </div>
  </div>
));
NameCell.displayName = "NameCell";

const StatusCell = memo(({ status, archivedAt }: { status?: string | null; archivedAt?: number | null }) => (
  <div>
    {status ? (
      <Badge variant="secondary" className={STATUS_COLORS[status] ?? ""}>
        {status}
      </Badge>
    ) : (
      <span className="text-muted-foreground">—</span>
    )}
    {archivedAt && (
      <Badge variant="secondary" className="ml-1 bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400">
        archived
      </Badge>
    )}
  </div>
));
StatusCell.displayName = "StatusCell";

export function getColumns({
  selectedIds,
  toggleOne,
}: {
  selectedIds: Set<string>;
  toggleOne: (id: string) => void;
}): ColumnDef<CompanyRow>[] {
  return [
    {
      id: "select",
      size: 40,
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={selectedIds.has(row.original.id)}
          onCheckedChange={() => toggleOne(row.original.id)}
          aria-label={`Select ${row.original.name}`}
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Company" />,
      size: 280,
      cell: ({ row }) => <NameCell name={row.original.name} website={row.original.website} />,
    },
    {
      id: "industry",
      accessorKey: "industry",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Industry" />,
      size: 150,
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.industry ?? "—"}</span>,
    },
    {
      id: "country",
      accessorKey: "country",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Country" />,
      size: 120,
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.country ?? "—"}</span>,
    },
    {
      id: "source",
      accessorKey: "source",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Source" />,
      size: 120,
      cell: ({ row }) => <span className="capitalize text-muted-foreground">{row.original.source ?? "—"}</span>,
    },
    {
      id: "status",
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      size: 140,
      cell: ({ row }) => <StatusCell status={row.original.status} archivedAt={row.original.archivedAt} />,
    },
    {
      id: "actions",
      header: "",
      size: 80,
      enableSorting: false,
      cell: () => null, // Filled by page via meta
    },
  ];
}
```

> **NOTE:** The `NameCell` link href should use the actual company `id`, not `name`. The column definition receives a `CompanyRow` where `id` is the company ID. Adjust `Link href` to use a stable identifier. Since this is extracted from the page, the page should map company data to `CompanyRow` with `id` = the convex document ID.

Create `apps/web/src/app/(dashboard)/companies/table-header.tsx`:

```tsx
"use client";

import { Search, Archive, RotateCcw, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CompaniesTableHeaderProps {
  search: string;
  onSearchChange: (value: string) => void;
  showArchived: boolean;
  onToggleArchived: () => void;
  selectedCount: number;
  onBulkArchive: () => void;
  onBulkRestore: () => void;
  onClearSelection: () => void;
  onAddCompany: () => void;
}

export function CompaniesTableHeader({
  search,
  onSearchChange,
  showArchived,
  onToggleArchived,
  selectedCount,
  onBulkArchive,
  onBulkRestore,
  onClearSelection,
  onAddCompany,
}: CompaniesTableHeaderProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search companies..."
              className="pl-9"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          <Button
            variant={showArchived ? "default" : "outline"}
            size="sm"
            onClick={onToggleArchived}
          >
            {showArchived ? "Hide Archived" : "Show Archived"}
          </Button>
        </div>
        <Button size="sm" onClick={onAddCompany}>
          <Plus className="mr-1 h-4 w-4" />
          Add Company
        </Button>
      </div>

      {selectedCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2">
          <span className="text-sm font-medium">{selectedCount} selected</span>
          <div className="h-4 w-px bg-border" />
          <Button variant="outline" size="sm" onClick={onBulkArchive}>
            <Archive className="mr-1 h-3.5 w-3.5" />
            Archive
          </Button>
          {showArchived && (
            <Button variant="outline" size="sm" onClick={onBulkRestore}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              Restore
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={onClearSelection}>
            <X className="mr-1 h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/companies/columns.tsx apps/web/src/app/\(dashboard\)/companies/table-header.tsx
git commit -m "feat: companies column definitions with memoized cells"
```

---

### Task 3: Refactor Companies page to use DataTable

**Files:**
- Modify: `apps/web/src/app/(dashboard)/companies/page.tsx`

**Step 1: Rewrite the page using DataTable**

Replace the entire `companies/page.tsx`. The page now:
1. Maps Convex data to `CompanyRow[]`
2. Uses `getColumns()` for column definitions
3. Renders `<DataTable>` + `<CompaniesTableHeader>`
4. Keeps the dialog, bulk actions, and create logic in the page

Key change: The table rendering is now handled by `DataTable<CompanyRow>` which uses TanStack Table internally. The `onRowClick` callback navigates to `/companies/${id}`.

**Step 2: Verify typecheck + visual test**

Run: `cd apps/web && npx tsc --noEmit`
Expected: PASS

Open browser to `http://localhost:3005/companies` and verify:
- Table renders with all columns
- Sorting works by clicking column headers
- Checkbox selection works
- Search filters rows
- Bulk actions work
- Row click navigates to company detail

**Step 3: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/companies/page.tsx
git commit -m "refactor: companies page uses TanStack DataTable"
```

---

## Phase 3: Contacts — Same Pattern

### Task 4: Create Contacts column definitions

**Files:**
- Create: `apps/web/src/app/(dashboard)/contacts/columns.tsx`
- Create: `apps/web/src/app/(dashboard)/contacts/table-header.tsx`

**Step 1: Write column definitions**

Create `apps/web/src/app/(dashboard)/contacts/columns.tsx`:

Same pattern as companies. Key cells:
- `ContactNameCell` (memo) — Avatar + full name + job title
- `EmailCell` (memo) — Mail icon + email
- `PhoneCell` (memo) — Phone icon + phone
- `StageCell` (memo) — Lifecycle badge using `LIFECYCLE_COLORS`
- `LastTouchCell` (memo) — "Xd ago" badge

Export type `ContactRow` and function `getColumns({ selectedIds, toggleOne })`.

Create `apps/web/src/app/(dashboard)/contacts/table-header.tsx`:

Search input + bulk actions bar (same structure as companies).

**Step 2: Verify typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/contacts/columns.tsx apps/web/src/app/\(dashboard\)/contacts/table-header.tsx
git commit -m "feat: contacts column definitions with memoized cells"
```

---

### Task 5: Refactor Contacts page to use DataTable

**Files:**
- Modify: `apps/web/src/app/(dashboard)/contacts/page.tsx`

**Step 1: Rewrite using DataTable**

Same pattern as Task 3. Map Convex data to `ContactRow[]`, use `getColumns()`, render `<DataTable>`.

**Step 2: Verify typecheck + visual test**

Run: `cd apps/web && npx tsc --noEmit`
Expected: PASS

Browser: `http://localhost:3005/contacts` — verify table, sort, select, search, archive.

**Step 3: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/contacts/page.tsx
git commit -m "refactor: contacts page uses TanStack DataTable"
```

---

## Phase 4: URL-Synced Filter State

### Task 6: Add nuqs-based URL state for Companies filters

**Files:**
- Create: `apps/web/src/hooks/use-companies-params.ts`
- Modify: `apps/web/src/app/(dashboard)/companies/page.tsx`

**Step 1: Create the params hook**

Create `apps/web/src/hooks/use-companies-params.ts`:

```ts
"use client";

import { parseAsString, parseAsBoolean, useQueryStates } from "nuqs";

export function useCompaniesParams() {
  const [params, setParams] = useQueryStates({
    q: parseAsString.withDefault(""),
    archived: parseAsBoolean.withDefault(false),
  });

  return {
    ...params,
    setParams,
    setSearch: (q: string) => setParams({ q: q || null }),
    toggleArchived: () => setParams({ archived: !params.archived ? true : null }),
  };
}
```

**Step 2: Integrate into Companies page**

Replace local `useState` for `search` and `showArchived` with `useCompaniesParams()`.
Now filters persist in the URL: `/companies?q=acme&archived=true`.

**Step 3: Verify typecheck + test URL persistence**

Run: `cd apps/web && npx tsc --noEmit`
Expected: PASS

Browser: Search "acme" → URL shows `?q=acme` → refresh → search persists.

**Step 4: Commit**

```bash
git add apps/web/src/hooks/use-companies-params.ts apps/web/src/app/\(dashboard\)/companies/page.tsx
git commit -m "feat: URL-synced filter state for companies (nuqs)"
```

---

### Task 7: Add nuqs-based URL state for Contacts filters

**Files:**
- Create: `apps/web/src/hooks/use-contacts-params.ts`
- Modify: `apps/web/src/app/(dashboard)/contacts/page.tsx`

**Step 1: Create the params hook**

```ts
"use client";

import { parseAsString, useQueryStates } from "nuqs";

export function useContactsParams() {
  const [params, setParams] = useQueryStates({
    q: parseAsString.withDefault(""),
  });

  return {
    ...params,
    setParams,
    setSearch: (q: string) => setParams({ q: q || null }),
  };
}
```

**Step 2: Integrate into Contacts page**

**Step 3: Verify typecheck + test**

**Step 4: Commit**

```bash
git add apps/web/src/hooks/use-contacts-params.ts apps/web/src/app/\(dashboard\)/contacts/page.tsx
git commit -m "feat: URL-synced filter state for contacts (nuqs)"
```

---

## Phase 5: Per-Column Skeletons (Midday Pattern)

### Task 8: Create skeleton components matching column shapes

**Files:**
- Create: `apps/web/src/components/data-table/skeleton.tsx`

**Step 1: Write table skeleton**

```tsx
import { Skeleton } from "@/components/ui/skeleton";

interface SkeletonColumn {
  type: "avatar-text" | "text" | "badge" | "icon";
  width?: string;
}

export function DataTableSkeleton({
  columns,
  rowCount = 5,
}: {
  columns: SkeletonColumn[];
  rowCount?: number;
}) {
  return (
    <div className="rounded-md border">
      {Array.from({ length: rowCount }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-0">
          {columns.map((col, j) => (
            <div key={j} className="flex-1 min-w-0">
              {col.type === "avatar-text" ? (
                <div className="flex items-center gap-3">
                  <Skeleton className="size-9 rounded-lg" />
                  <div className="space-y-1.5">
                    <Skeleton className={`h-3.5 ${col.width ?? "w-28"}`} />
                    <Skeleton className="h-2.5 w-20" />
                  </div>
                </div>
              ) : col.type === "badge" ? (
                <Skeleton className="h-5 w-16 rounded-full" />
              ) : col.type === "icon" ? (
                <Skeleton className="size-8 rounded" />
              ) : (
                <Skeleton className={`h-3.5 ${col.width ?? "w-20"}`} />
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Use in Companies and Contacts pages**

Replace the current `{Array.from({ length: 5 }).map(...)` skeletons with:

```tsx
import { DataTableSkeleton } from "@/components/data-table/skeleton";

// In the isLoading branch:
<DataTableSkeleton
  columns={[
    { type: "icon", width: "w-10" },    // select checkbox
    { type: "avatar-text", width: "w-32" }, // name + website
    { type: "text", width: "w-20" },     // industry
    { type: "text", width: "w-16" },     // country
    { type: "text", width: "w-16" },     // source
    { type: "badge" },                   // status
    { type: "icon" },                    // actions
  ]}
/>
```

**Step 3: Verify typecheck**

**Step 4: Commit**

```bash
git add apps/web/src/components/data-table/skeleton.tsx apps/web/src/app/\(dashboard\)/companies/page.tsx apps/web/src/app/\(dashboard\)/contacts/page.tsx
git commit -m "feat: per-column skeleton loading (Midday pattern)"
```

---

## Summary

| Task | Description | Effort | Dependencies |
|------|-------------|--------|-------------|
| 1 | Shared DataTable component | 15 min | None |
| 2 | Companies column defs | 10 min | Task 1 |
| 3 | Companies page refactor | 15 min | Task 2 |
| 4 | Contacts column defs | 10 min | Task 1 |
| 5 | Contacts page refactor | 15 min | Task 4 |
| 6 | Companies URL filters (nuqs) | 10 min | Task 3 |
| 7 | Contacts URL filters (nuqs) | 5 min | Task 5 |
| 8 | Per-column skeletons | 10 min | Task 3, 5 |

**Total: ~90 minutes**

**No new dependencies required** — everything uses packages already in `package.json`.

**After completion:** Companies and Contacts pages will have sortable columns, memoized cells (better scroll perf), URL-persisted filters, and shape-accurate skeleton loading — matching Midday's production patterns.
