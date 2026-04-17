'use client';

import { useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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

const statusConfig: Record<
  SyncLogEntry['status'],
  {
    icon: typeof CheckCircle2;
    color: string;
    badgeVariant: 'default' | 'secondary' | 'destructive';
    label: string;
  }
> = {
  success: {
    icon: CheckCircle2,
    color: 'text-green-600',
    badgeVariant: 'default',
    label: 'Berhasil',
  },
  partial: {
    icon: AlertTriangle,
    color: 'text-yellow-600',
    badgeVariant: 'secondary',
    label: 'Sebagian',
  },
  failed: {
    icon: XCircle,
    color: 'text-red-600',
    badgeVariant: 'destructive',
    label: 'Gagal',
  },
};

function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SyncLogsDialog({
  pluginId,
  pluginName,
  open,
  onOpenChange,
}: SyncLogsDialogProps) {
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([]);
  const currentCursor = cursorStack[cursorStack.length - 1] ?? null;

  const logs = useAuthQuery(api.externalPlugins.getSyncLogs, {
    externalPluginId: pluginId,
    paginationOpts: {
      numItems: 20,
      cursor: open ? currentCursor : 'skip',
    },
  });

  function handleNext() {
    const nextCursor = logs.data?.continuationCursor ?? null;
    if (nextCursor && !logs.data?.isDone) {
      setCursorStack((prev) => [...prev, nextCursor]);
    }
  }

  function handlePrev() {
    setCursorStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : []));
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      setCursorStack([]);
    }
    onOpenChange(newOpen);
  }

  // Compute summary from current page
  const pageEntries = logs.data?.page ?? [];
  const successCount = pageEntries.filter((e) => e.status === 'success').length;
  const failedCount = pageEntries.filter((e) => e.status === 'failed').length;
  const totalRecords = pageEntries.reduce((sum, e) => sum + e.recordCount, 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Log Sinkronisasi — {pluginName}
          </DialogTitle>
          <DialogDescription>
            Riwayat log sinkronisasi data antara CRM dan plugin eksternal.
          </DialogDescription>
        </DialogHeader>

        <Separator />

        {/* Summary row */}
        {pageEntries.length > 0 && (
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              {successCount} berhasil
            </span>
            <span className="flex items-center gap-1 text-red-600">
              <XCircle className="h-4 w-4" />
              {failedCount} gagal
            </span>
            <span className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              {totalRecords} record
            </span>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {logs.isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Memuat log...
            </div>
          ) : pageEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-8 w-8 mb-2 opacity-50" />
              <p>Belum ada log sinkronisasi</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background border-b">
                <tr className="text-left text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Waktu</th>
                  <th className="py-2 pr-3 font-medium">Arah</th>
                  <th className="py-2 pr-3 font-medium">Tabel</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium text-right">Records</th>
                  <th className="py-2 font-medium text-right">Durasi</th>
                </tr>
              </thead>
              <tbody>
                {pageEntries.map((entry) => {
                  const cfg = statusConfig[entry.status as SyncLogEntry['status']];
                  const StatusIcon = cfg.icon;
                  const DirectionIcon =
                    entry.direction === 'pull' ? ArrowDownToLine : ArrowUpFromLine;
                  const dirColor =
                    entry.direction === 'pull' ? 'text-blue-600' : 'text-purple-600';

                  return (
                    <tr key={entry.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {formatDate(entry.createdAt)}
                      </td>
                      <td className="py-2 pr-3">
                        <DirectionIcon
                          className={`h-4 w-4 ${dirColor}`}
                        />
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs">
                        {entry.table}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge
                          variant={cfg.badgeVariant}
                          className="flex items-center gap-1 w-fit"
                        >
                          <StatusIcon className="h-3 w-3" />
                          {cfg.label}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {entry.recordCount}
                      </td>
                      <td className="py-2 text-right text-muted-foreground tabular-nums">
                        {formatDuration(entry.durationMs)}
                      </td>
                    </tr>
                  );
                })}

                {/* Error rows */}
                {pageEntries
                  .filter((e) => e.errorMessage)
                  .map((entry) => (
                    <tr key={`${entry.id}-error`} className="border-b last:border-b-0">
                      <td colSpan={6} className="py-2 px-3">
                        <div className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
                          <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          <div>
                            <span className="font-medium">
                              [{entry.table}]{' '}
                            </span>
                            {entry.errorMessage}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>

        <Separator />

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {pageEntries.length} entri
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrev}
              disabled={cursorStack.length <= 1 || logs.isLoading}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              disabled={
                logs.isLoading ||
                !logs.data?.continuationCursor ||
                logs.data.isDone
              }
            >
              Berikutnya
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
