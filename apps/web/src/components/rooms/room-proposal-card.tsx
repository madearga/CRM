'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { OperationTag } from './ascii';

import type { RoomProposal } from './types';
import { RuangIcon, type RuangIconName } from '@/components/icons/icon';

const KIND_LABEL: Record<string, string> = {
  create_activity: 'Buat Aktivitas',
  update_deal_stage: 'Ubah Tahap Deal',
};

const STATUS_META: Record<
  string,
  { label: string; className: string; icon: RuangIconName }
> = {
  awaiting_approval: {
    label: 'Menunggu persetujuan',
    className: 'border-orange-500/30 bg-orange-500/10 text-orange-400',
    icon: 'lucide:clock',
  },
  executing: {
    label: 'Sedang dijalankan',
    className: 'border-chart-1/30 bg-chart-1/10 text-chart-1',
    icon: 'lucide:loader-circle',
  },
  pending: {
    label: 'Menunggu eksekusi',
    className: 'border-border bg-muted text-muted-foreground',
    icon: 'lucide:circle-dot',
  },
  succeeded: {
    label: 'Berhasil',
    className: 'border-green-500/30 bg-green-500/10 text-green-400',
    icon: 'lucide:circle-check-big',
  },
  failed: {
    label: 'Gagal',
    className: 'border-red-500/30 bg-red-500/10 text-red-400',
    icon: 'lucide:circle-alert',
  },
  unknown: {
    label: 'Status tidak diketahui',
    className: 'border-border bg-muted text-muted-foreground',
    icon: 'lucide:circle-help',
  },
  rejected: {
    label: 'Ditolak',
    className: 'border-border bg-muted text-muted-foreground',
    icon: 'lucide:circle-x',
  },
};

export type RoomProposalCardProps = {
  proposal: RoomProposal;
  canDecide: boolean;
  isDeciding: boolean;
  onDecide: (operationId: string, decision: 'approve' | 'reject') => void;
};

/**
 * A proposal sits in the thread as a small card. It shows what the agent wants
 * to do and, when the room waits for a decision, the two buttons that settle
 * it.
 */
export function RoomProposalCard({
  proposal,
  canDecide,
  isDeciding,
  onDecide,
}: RoomProposalCardProps) {
  const status = STATUS_META[proposal.status] ?? STATUS_META.unknown;
  const kindLabel = KIND_LABEL[proposal.kind] ?? humanizeKind(proposal.kind);
  const canApprove = canDecide && proposal.status === 'awaiting_approval';

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="h-5 text-[11px]">
          {kindLabel}
        </Badge>
        <span
          className={`inline-flex h-5 items-center gap-1 rounded-md border px-1.5 text-[11px] ${status.className}`}
        >
          <RuangIcon name={status.icon} className="h-3 w-3" />
          {status.label}
        </span>
        <OperationTag operationId={proposal.operationId} className="ml-auto" />
        {proposal.duplicate ? (
          <span className="text-[11px] text-muted-foreground">
            Proposal duplikat
          </span>
        ) : null}
      </div>

      {proposal.summary ? (
        <p className="mt-1.5 text-sm whitespace-pre-wrap">{proposal.summary}</p>
      ) : null}

      {canApprove ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            disabled={isDeciding}
            onClick={() => onDecide(proposal.operationId, 'approve')}
            className="h-11 sm:h-8"
          >
            Setujui
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isDeciding}
            onClick={() => onDecide(proposal.operationId, 'reject')}
            className="h-11 sm:h-8"
          >
            Tolak
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function humanizeKind(kind: string): string {
  if (!kind) return 'Proposal';
  const words = kind.replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
