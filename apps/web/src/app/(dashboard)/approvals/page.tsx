'use client';

import { useMemo, useState } from 'react';
import {
  useAuthQuery,
  useAuthMutation,
  useAuthAction,
  useCurrentUser,
} from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/empty-state';
import {
  usePermission,
  usePermissionsWithStatus,
} from '@/lib/permissions/use-permission';
import { formatDistanceToNow } from '@/lib/format-date';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Fingerprint,
  Inbox,
  Play,
  RefreshCw,
  ShieldCheck,
  User,
} from 'lucide-react';

/** A readable name for every known kind of operation. */
const KIND_LABELS: Record<string, string> = {
  create_activity: 'Buat aktivitas',
  update_deal_stage: 'Ubah tahap deal',
};

/**
 * The colour of a status badge. The palette is muted and low in saturation.
 * The badge always carries the status word, so the colour is never the only
 * sign of the state.
 */
const STATUS_BADGE: Record<
  string,
  { label: string; className: string }
> = {
  pending: {
    label: 'Menunggu',
    className:
      'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  },
  awaiting_approval: {
    label: 'Menunggu persetujuan',
    className:
      'border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-400',
  },
  executing: {
    label: 'Sedang berjalan',
    className:
      'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-400',
  },
  succeeded: {
    label: 'Berhasil',
    className:
      'border-green-500/25 bg-green-500/10 text-green-700 dark:text-green-400',
  },
  failed: {
    label: 'Gagal',
    className:
      'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-400',
  },
  unknown: {
    label: 'Tidak diketahui',
    className:
      'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  },
  rejected: {
    label: 'Ditolak',
    className: 'border-border bg-muted text-muted-foreground',
  },
};

function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}

/** A readable date with the time of the day. */
function formatMoment(timestamp: number): string {
  return new Date(timestamp).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/** The canonical payload text, pretty printed when it is parsable JSON. */
function readablePayload(payloadJson: string | undefined): string {
  if (!payloadJson) return '—';
  try {
    return JSON.stringify(JSON.parse(payloadJson), null, 2);
  } catch {
    return payloadJson;
  }
}

function StatusBadge({ status }: { status: string }) {
  const badge = STATUS_BADGE[status] ?? {
    label: status,
    className: 'border-border bg-muted text-muted-foreground',
  };
  return (
    <Badge variant="outline" className={badge.className}>
      {badge.label}
    </Badge>
  );
}

export default function ApprovalsPage() {
  const canView = usePermission('agents', 'view');
  const canManage = usePermission('agents', 'manage');
  const { isLoading: loadingPermissions } = usePermissionsWithStatus();
  const currentUser = useCurrentUser();
  const slug = currentUser?.activeOrganization?.slug ?? '';

  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [decisionError, setDecisionError] = useState<string | null>(null);

  // The queries are live: the list follows the server without a manual reload.
  const { data: pending, isLoading: loadingPending } = useAuthQuery(
    api.agentOperations.listPendingApprovals,
    canView ? {} : 'skip',
  );

  const { data: recent, isLoading: loadingRecent } = useAuthQuery(
    api.agentOperations.list,
    canView ? { limit: 20 } : 'skip',
  );

  const { data: detail, isLoading: loadingDetail } = useAuthQuery(
    api.agentOperations.get,
    reviewId ? { operationId: reviewId as any } : 'skip',
  );

  const { data: membersData } = useAuthQuery(
    api.organization.listMembers,
    slug ? { slug } : 'skip',
  );

  const decide = useAuthMutation(api.agentOperations.decide);
  const reconcile = useAuthMutation(api.agentOperations.reconcile);
  const execute = useAuthAction((api as any).agentOperations.execute);

  const requesterNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of membersData?.members ?? []) {
      const name = member.user?.name || member.user?.email;
      if (name) map.set(member.userId, name);
    }
    return map;
  }, [membersData]);

  const requesterName = (userId: string) =>
    requesterNames.get(userId) ?? `Pengguna ${userId.slice(-6)}`;

  const openReview = (operationId: string) => {
    setComment('');
    setDecisionError(null);
    setReviewId(operationId);
    setReviewOpen(true);
  };

  const closeReview = () => {
    setReviewOpen(false);
    setReviewId(null);
    setComment('');
    setDecisionError(null);
  };

  const runDecision = async (
    operationId: string,
    decision: 'approve' | 'reject',
    withComment: boolean,
  ) => {
    try {
      const result = await decide.mutateAsync({
        operationId: operationId as any,
        decision,
        ...(withComment && comment.trim()
          ? { comment: comment.trim() }
          : {}),
      } as any);

      const status = (result as any)?.status;
      toast.success(
        decision === 'approve'
          ? `Persetujuan diberikan. Status operasi: ${status ?? 'disetujui'}.`
          : `Persetujuan ditolak. Status operasi: ${status ?? 'ditolak'}.`,
      );
      closeReview();
    } catch (error: any) {
      const message =
        error?.data?.message ??
        error?.message ??
        'Keputusan tidak dapat disimpan.';
      setDecisionError(message);
      toast.error(message);
    }
  };

  const runExecute = async (operationId: string) => {
    try {
      const result: any = await execute.mutateAsync({ operationId });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      if (result?.duplicate) {
        toast.success('Operasi sudah pernah dijalankan. Tidak ada efek baru.');
        return;
      }
      toast.success('Operasi dijalankan.');
    } catch (error: any) {
      toast.error(
        error?.data?.message ?? error?.message ?? 'Operasi gagal dijalankan.',
      );
    }
  };

  const runReconcile = async (
    operationId: string,
    resolution: 'retry' | 'succeed' | 'fail',
  ) => {
    try {
      await reconcile.mutateAsync({ operationId: operationId as any, resolution } as any);
      toast.success(
        resolution === 'retry'
          ? 'Operasi ditandai untuk dijalankan ulang.'
          : resolution === 'succeed'
            ? 'Operasi ditandai berhasil.'
            : 'Operasi ditandai gagal.',
      );
    } catch (error: any) {
      toast.error(
        error?.data?.message ?? error?.message ?? 'Status tidak dapat diubah.',
      );
    }
  };

  if (!canView) {
    if (loadingPermissions) {
      return (
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
        <AlertTriangle className="size-4" />
        Anda tidak punya hak untuk melihat halaman persetujuan.
      </div>
    );
  }

  const pendingList = pending ?? [];
  const recentList = recent ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Persetujuan</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lihat persis apa yang akan dikerjakan agen, lalu putuskan apakah
            operasi itu boleh berjalan.
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0">
          {pendingList.length} menunggu
        </Badge>
      </div>

      {!canManage ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" />
          Anda dapat membaca daftar ini. Menyetujui atau menolak memerlukan hak
          kelola agen.
        </p>
      ) : null}

      {/* Menunggu keputusan */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium">Menunggu keputusan</h2>

        {loadingPending ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : pendingList.length === 0 ? (
          <EmptyState
            icon={<Inbox className="size-6" />}
            title="Tidak ada permintaan menunggu"
            description="Permintaan persetujuan dari agen akan muncul di sini."
            className="py-8"
          />
        ) : (
          <div className="space-y-2">
            {pendingList.map((approval: any) => (
              <div
                key={approval.id}
                className="flex items-start gap-3 rounded-md border bg-card p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-muted-foreground">
                      {kindLabel(approval.kind)}
                    </Badge>
                    <StatusBadge status="pending" />
                  </div>
                  {approval.summary ? (
                    <p className="mt-1.5 truncate text-sm text-foreground">
                      {approval.summary}
                    </p>
                  ) : null}
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <User className="size-3" />
                      {requesterName(approval.requestedByUserId)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3" />
                      {formatDistanceToNow(approval.createdAt)}
                    </span>
                    {approval.expiresAt ? (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" />
                        Berlaku sampai {formatMoment(approval.expiresAt)}
                      </span>
                    ) : null}
                  </p>
                </div>

                {canManage ? (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openReview(approval.operationId)}
                    >
                      Tinjau
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={decide.isPending}
                      onClick={() =>
                        runDecision(approval.operationId, 'reject', false)
                      }
                    >
                      Tolak
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Dialog: tinjau operasi */}
      <Dialog
        open={reviewOpen}
        onOpenChange={(open) => {
          if (!open) closeReview();
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tinjau operasi</DialogTitle>
            <DialogDescription>
              Rincian lengkap yang akan dikerjakan agen bila disetujui.
            </DialogDescription>
          </DialogHeader>

          {loadingDetail ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : !detail ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="size-4" />
              Rincian operasi tidak dapat dimuat.
            </p>
          ) : (
            <div className="space-y-4">
              <dl className="space-y-2 text-sm">
                <div className="flex gap-2">
                  <dt className="w-32 shrink-0 text-muted-foreground">Jenis</dt>
                  <dd>{kindLabel(detail.kind)}</dd>
                </div>
                {detail.summary ? (
                  <div className="flex gap-2">
                    <dt className="w-32 shrink-0 text-muted-foreground">
                      Ringkasan
                    </dt>
                    <dd>{detail.summary}</dd>
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <dt className="w-32 shrink-0 text-muted-foreground">
                    Diminta oleh
                  </dt>
                  <dd>{requesterName(detail.requestedByUserId)}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-32 shrink-0 text-muted-foreground">Dibuat</dt>
                  <dd>{formatMoment(detail.createdAt)}</dd>
                </div>
                {detail.expiresAt ? (
                  <div className="flex gap-2">
                    <dt className="w-32 shrink-0 text-muted-foreground">
                      Kedaluwarsa
                    </dt>
                    <dd>{formatMoment(detail.expiresAt)}</dd>
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <dt className="w-32 shrink-0 text-muted-foreground">Status</dt>
                  <dd>
                    <StatusBadge status={detail.status} />
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-32 shrink-0 text-muted-foreground">Hash</dt>
                  <dd className="flex min-w-0 items-start gap-1 font-mono text-xs text-muted-foreground">
                    <Fingerprint className="mt-0.5 size-3 shrink-0" />
                    <span className="break-all">{detail.payloadHash}</span>
                  </dd>
                </div>
              </dl>

              <div className="space-y-1.5">
                <p className="text-sm font-medium">Payload</p>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/40 p-3 font-mono text-xs">
                  {readablePayload(detail.payloadJson)}
                </pre>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="approval-comment">Catatan (opsional)</Label>
                <Textarea
                  id="approval-comment"
                  rows={2}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Alasan keputusan, dibaca anggota tim lain."
                />
              </div>

              {decisionError ? (
                <p className="flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="size-4 shrink-0" />
                  {decisionError}
                </p>
              ) : null}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              disabled={decide.isPending || loadingDetail || !detail}
              onClick={() => {
                if (reviewId) runDecision(reviewId, 'reject', true);
              }}
            >
              Tolak
            </Button>
            <Button
              disabled={decide.isPending || loadingDetail || !detail}
              onClick={() => {
                if (reviewId) runDecision(reviewId, 'approve', true);
              }}
            >
              Setujui
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Terbaru */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium">Terbaru</h2>

        {loadingRecent ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : recentList.length === 0 ? (
          <EmptyState
            icon={<Clock className="size-6" />}
            title="Belum ada operasi"
            description="Operasi agen akan tercatat di sini setelah dijalankan."
            className="py-8"
          />
        ) : (
          <div className="space-y-2">
            {recentList.map((operation: any) => (
              <div
                key={operation.id}
                className="flex items-start gap-3 rounded-md border bg-card p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={operation.status} />
                    <Badge variant="outline" className="text-muted-foreground">
                      {kindLabel(operation.kind)}
                    </Badge>
                    {operation.agentLabel ? (
                      <span className="text-xs text-muted-foreground">
                        {operation.agentLabel}
                      </span>
                    ) : null}
                  </div>
                  {operation.summary ? (
                    <p className="mt-1.5 truncate text-sm text-foreground">
                      {operation.summary}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Diperbarui {formatDistanceToNow(operation.updatedAt)}
                  </p>

                  {operation.status === 'unknown' ? (
                    <div className="mt-2 space-y-2 rounded-md border border-amber-500/25 bg-amber-500/5 p-2.5">
                      <p className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                        Hasil operasi tidak diketahui. Periksa apa yang sebenarnya
                        terjadi, lalu pilih salah satu langkah berikut.
                      </p>
                      {canManage ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={reconcile.isPending}
                            onClick={() =>
                              runReconcile(operation.id, 'retry')
                            }
                          >
                            <RefreshCw className="size-3.5" />
                            Jalankan ulang
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={reconcile.isPending}
                            onClick={() =>
                              runReconcile(operation.id, 'succeed')
                            }
                          >
                            <CheckCircle2 className="size-3.5" />
                            Tandai berhasil
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={reconcile.isPending}
                            onClick={() => runReconcile(operation.id, 'fail')}
                          >
                            Tandai gagal
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {canManage &&
                operation.status === 'pending' &&
                !operation.requiresApproval ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    disabled={execute.isPending}
                    onClick={() => runExecute(operation.id)}
                  >
                    <Play className="size-3.5" />
                    Jalankan
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
