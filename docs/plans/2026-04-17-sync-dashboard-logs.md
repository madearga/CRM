# Sync Dashboard & Logs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Sync Logs viewer inside the External Plugin Card so users can inspect full sync history — success/failure, record counts, duration, and error details.

**Architecture:** Dialog-based viewer opened from ExternalPluginCard. Uses existing `getSyncLogs` paginated query. Shows a table of log entries with status badges, direction arrows, timestamps, and expandable error messages. Includes summary stats at top.

**Tech Stack:** React, Convex (cursor-based pagination), shadcn/ui (Dialog, Table, Badge, Button), Lucide icons, sonner toasts, `useAuthQuery`/`useAuthMutation` hooks.

---

### Task 1: Add Sync Logs Button to ExternalPluginCard

**Files:**
- Modify: `apps/web/src/components/external-plugin/external-plugin-card.tsx:19-21` (imports)
- Modify: `apps/web/src/components/external-plugin/external-plugin-card.tsx:147-158` (API Key section bottom)

**Step 1: Add imports for new dialog**

Add `FileText` to lucide imports and import the new dialog component:

```tsx
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Unplug,
  Trash2,
  ExternalLink,
  FileText,
} from 'lucide-react';
```

```tsx
import { SyncLogsDialog } from './sync-logs-dialog';
```

**Step 2: Add state for dialog open/close**

Add after existing `useState` line (~line 29):

```tsx
const [logsOpen, setLogsOpen] = useState(false);
```

**Step 3: Add "Lihat Log" button next to Reverify/Trash buttons**

In the header actions area (around line 87), add before the existing buttons:

```tsx
<Button variant="ghost" size="sm" onClick={() => setLogsOpen(true)}>
  <FileText className="size-4" />
</Button>
```

**Step 4: Add SyncLogsDialog at end of component return**

After the closing `</Card>`, wrap with a fragment and add:

```tsx
<SyncLogsDialog
  pluginId={plugin.id}
  pluginName={plugin.name}
  open={logsOpen}
  onOpenChange={setLogsOpen}
/>
```

**Step 5: Verify no TS errors**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -30`

Expected: Error about missing `sync-logs-dialog` module (expected — we create it in Task 2).

**Step 6: Commit**

```bash
git add apps/web/src/components/external-plugin/external-plugin-card.tsx
git commit -m "feat(plugins): add sync logs button to ExternalPluginCard"
```

---

### Task 2: Build SyncLogsDialog Component

**Files:**
- Create: `apps/web/src/components/external-plugin/sync-logs-dialog.tsx`

**Step 1: Create the dialog component**

```tsx
'use client';

import { useState, useCallback } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  FileText,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuthQuery } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import type { SyncLogEntry } from '@/lib/plugins/types';

interface SyncLogsDialogProps {
  pluginId: string;
  pluginName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_CONFIG = {
  success: {
    icon: CheckCircle2,
    label: 'Berhasil',
    variant: 'default' as const,
    color: 'text-green-600',
  },
  partial: {
    icon: AlertTriangle,
    label: 'Sebagian',
    variant: 'secondary' as const,
    color: 'text-yellow-600',
  },
  failed: {
    icon: XCircle,
    label: 'Gagal',
    variant: 'destructive' as const,
    color: 'text-red-600',
  },
};

export function SyncLogsDialog({
  pluginId,
  pluginName,
  open,
  onOpenChange,
}: SyncLogsDialogProps) {
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([]);
  const currentCursor = cursorStack[cursorStack.length - 1] ?? null;

  const { data, isLoading } = useAuthQuery(
    api.externalPlugins.getSyncLogs,
    open
      ? {
          externalPluginId: pluginId,
          paginationOpts: { numItems: 20, cursor: currentCursor },
        }
      : 'skip'
  );

  const entries: SyncLogEntry[] = data?.page ?? [];
  const isDone = data?.isDone ?? true;
  const nextCursor = data?.continuationCursor ?? null;

  function handleNext() {
    if (nextCursor) {
      setCursorStack((prev) => [...prev, nextCursor]);
    }
  }

  function handlePrev() {
    setCursorStack((prev) => prev.slice(0, -1));
  }

  function handleOpenChange(val: boolean) {
    if (!val) {
      setCursorStack([]);
    }
    onOpenChange(val);
  }

  // Summary stats from current page
  const successCount = entries.filter((e) => e.status === 'success').length;
  const failedCount = entries.filter((e) => e.status === 'failed').length;
  const totalRecords = entries.reduce((sum, e) => sum + e.recordCount, 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5" />
            Log Sinkronisasi — {pluginName}
          </DialogTitle>
          <DialogDescription>
            Riwayat sinkronisasi data antara toko external dan CRM.
          </DialogDescription>
        </DialogHeader>

        {/* Summary */}
        {!isLoading && entries.length > 0 && (
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1">
              <CheckCircle2 className="size-4 text-green-600" />
              <span>{successCount} berhasil</span>
            </div>
            <div className="flex items-center gap-1">
              <XCircle className="size-4 text-red-500" />
              <span>{failedCount} gagal</span>
            </div>
            <div className="flex items-center gap-1">
              <ArrowDownToLine className="size-4 text-muted-foreground" />
              <span>{totalRecords} records</span>
            </div>
          </div>
        )}

        <Separator />

        {/* Log table */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Belum ada log sinkronisasi.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Waktu</th>
                  <th className="pb-2 pr-4 font-medium">Arah</th>
                  <th className="pb-2 pr-4 font-medium">Tabel</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium text-right">Records</th>
                  <th className="pb-2 pr-4 font-medium text-right">Durasi</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const config = STATUS_CONFIG[entry.status] ?? STATUS_CONFIG.failed;
                  const StatusIcon = config.icon;
                  return (
                    <tr key={entry.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">
                        {new Date(entry.createdAt).toLocaleString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2 pr-4">
                        {entry.direction === 'pull' ? (
                          <ArrowDownToLine className="size-4 text-blue-500" />
                        ) : (
                          <ArrowUpFromLine className="size-4 text-purple-500" />
                        )}
                      </td>
                      <td className="py-2 pr-4 capitalize">{entry.table}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={config.variant} className="gap-1">
                          <StatusIcon className="size-3" />
                          {config.label}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {entry.recordCount}
                      </td>
                      <td className="py-2 pr-4 text-right text-muted-foreground tabular-nums">
                        {entry.durationMs != null
                          ? entry.durationMs >= 1000
                            ? `${(entry.durationMs / 1000).toFixed(1)}s`
                            : `${entry.durationMs}ms`
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {entries.length > 0 && (
          <>
            <Separator />
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                Menampilkan {entries.length} log
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrev}
                  disabled={cursorStack.length === 0}
                >
                  <ChevronLeft className="mr-1 size-4" />
                  Sebelumnya
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNext}
                  disabled={isDone || !nextCursor}
                >
                  Selanjutnya
                  <ChevronRight className="ml-1 size-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Verify no TS errors**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -30`

Expected: 0 errors. If `paginationOpts` type mismatches, check `useAuthQuery` wrapper — may need to pass `{ numItems: 20, cursor: null }` as plain object.

**Step 3: Commit**

```bash
git add apps/web/src/components/external-plugin/sync-logs-dialog.tsx
git commit -m "feat(plugins): add SyncLogsDialog component with paginated log viewer"
```

---

### Task 3: Add Expandable Error Row for Failed Syncs

**Files:**
- Modify: `apps/web/src/components/external-plugin/sync-logs-dialog.tsx`

**Step 1: Add expandable error detail row**

Inside the `<tbody>` map, after each `<tr>`, add a conditional error row:

```tsx
{entry.errorMessage && (
  <tr key={`${entry.id}-error`}>
    <td colSpan={6} className="bg-red-50 px-4 py-2 text-xs text-red-700 dark:bg-red-950/20 dark:text-red-400">
      <span className="font-medium">Error:</span> {entry.errorMessage}
    </td>
  </tr>
)}
```

This goes immediately after the closing `</tr>` of the main entry row, still inside the `.map()`.

**Step 2: Verify build**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -20`

Expected: 0 errors.

**Step 3: Commit**

```bash
git add apps/web/src/components/external-plugin/sync-logs-dialog.tsx
git commit -m "feat(plugins): show error details for failed sync log entries"
```

---

### Task 4: Integration Test — Verify Dialog Works with Real Data

**Files:**
- No new files — manual verification

**Step 1: Start dev server**

Run: `cd apps/web && npm run dev`

**Step 2: Manual verification checklist**

1. Open `/settings/plugins` in browser
2. Confirm external plugin card shows "Log" button (FileText icon)
3. Click the button → dialog opens
4. If no logs exist: see "Belum ada log sinkronisasi" empty state
5. Trigger a sync (Pull products/orders/customers) from the card
6. Re-open logs dialog → see new entry with correct direction, status, record count
7. Verify pagination buttons work (if >20 entries)
8. Verify dialog closes and resets pagination state on re-open

**Step 3: Run full test suite**

Run: `npx convex test 2>&1 | tail -20`

Expected: All 220+ tests pass.

**Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix(plugins): sync logs dialog fixes from manual testing"
```

---

## File Summary

| Action | File | Purpose |
|--------|------|---------|
| Modify | `apps/web/src/components/external-plugin/external-plugin-card.tsx` | Add log button + dialog trigger |
| Create | `apps/web/src/components/external-plugin/sync-logs-dialog.tsx` | Full paginated log viewer dialog |
| No change | `convex/externalPlugins.ts` | `getSyncLogs` query already exists |
| No change | `apps/web/src/lib/plugins/types.ts` | `SyncLogEntry` type already exists |

## Dependencies
- All backend queries (`getSyncLogs`) already implemented ✅
- All types (`SyncLogEntry`) already defined ✅
- UI components (Dialog, Badge, Button, Separator) already in project ✅
