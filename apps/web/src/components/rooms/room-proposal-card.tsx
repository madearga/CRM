'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  CheckCircle2,
  CircleDot,
  Clock,
  HelpCircle,
  XCircle,
} from 'lucide-react';

import { OperationTag } from './ascii';

import type { RoomProposal } from './types';

const KIND_LABEL: Record<string, string> = {
  create_activity: 'Buat Aktivitas',
  update_deal_stage: 'Ubah Tahap Deal',
};

const STATUS_META: Record<
  string,
  { label: string; className: string; icon: typeof Clock }
> = {
  awaiting_approval: {
    label: 'Menunggu persetujuan',
    className: 'border-orange-500/30 bg-orange-500/10 text-orange-400',
    icon: Clock,
  },
  pending: {
    label: 'Menunggu eksekusi',
    className: 'border-border bg-muted text-muted-foreground',
    icon: CircleDot,
  },
  succeeded: {
    label: 'Berhasil',
    className: 'border-green-500/30 bg-green-500/10 text-green-400',
    icon: CheckCircle2,
  },
  failed: {
    label: 'Gagal',
    className: 'border-red-500/30 bg-red-500/10 text-red-400',
    icon: AlertCircle,
  },
  unknown: {
    label: 'Status tidak diketahui',
    className: 'border-border bg-muted text-muted-foreground',
    icon: HelpCircle,
  },
  rejected: {
    label: 'Ditolak',
    className: 'border-border bg-muted text-muted-foreground',
    icon: XCircle,
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
  const StatusIcon = status.icon;
  const kindLabel = KIND_LABEL[proposal.kind] ?? humanizeKind(proposal.kind);
  const canApprove = canDecide && proposal.status === 'awaiting_approval';

  return (
    <div className="glass rounded-md p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="h-5 text-[11px]">
          {kindLabel}
        </Badge>
        <Badge className={`h-5 gap-1 text-[11px] ${status.className}`}>
          <StatusIcon className="h-3 w-3" />
          {status.label}
        </Badge>
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
            className="transition-transform duration-[160ms] ease-out active:scale-[0.97]"
          >
            Setujui
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isDeciding}
            onClick={() => onDecide(proposal.operationId, 'reject')}
            className="transition-transform duration-[160ms] ease-out active:scale-[0.97]"
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
