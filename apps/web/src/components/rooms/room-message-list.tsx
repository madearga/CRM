'use client';

import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/empty-state';
import { Bot, MessageSquare } from 'lucide-react';

import { formatDistanceToNow } from '@/lib/format-date';

import { formatRoomTimestamp } from './format';
import { RoomProposalCard } from './room-proposal-card';
import { RoomThinkingDots } from './room-thinking-dots';
import type { RoomListMessage, RoomProposal } from './types';

const MESSAGE_KIND_LABEL: Record<string, string> = {
  proposal: 'Proposal',
  decision: 'Keputusan',
  system: 'Sistem',
};

const STAGGER_STEP_MS = 40;
const STAGGER_LIMIT = 5;

export type RoomMessageListProps = {
  messages: RoomListMessage[];
  agentName: string;
  isThinking: boolean;
  canDecide: boolean;
  decidingOperationId: string | null;
  proposals: Record<string, RoomProposal>;
  /** Proposals that have no message in the thread yet. */
  trailingProposals: RoomProposal[];
  onDecide: (operationId: string, decision: 'approve' | 'reject') => void;
};

/**
 * The thread. New messages arrive with a small lift, and the agent shows a
 * quiet thought bubble while it works.
 */
export function RoomMessageList({
  messages,
  agentName,
  isThinking,
  canDecide,
  decidingOperationId,
  proposals,
  trailingProposals,
  onDecide,
}: RoomMessageListProps) {
  const isEmpty = messages.length === 0 && trailingProposals.length === 0;

  return (
    <div
      className="flex flex-col gap-3 p-4"
      role="log"
      aria-live="polite"
      aria-label="Percakapan ruang"
    >
      {isEmpty && !isThinking ? (
        <EmptyState
          icon={<MessageSquare className="size-6" />}
          title="Belum ada pesan"
          description="Pesan pertama di ruang ini ditulis di bawah."
          className="py-8"
        />
      ) : null}

      {messages.map((message, index) => (
        <RoomMessageRow
          key={message.id}
          message={message}
          index={index}
          proposals={proposals}
          canDecide={canDecide}
          decidingOperationId={decidingOperationId}
          onDecide={onDecide}
        />
      ))}

      {trailingProposals.map((proposal) => (
        <div
          key={`trailing-${proposal.operationId}`}
          className="room-message"
          style={{ transitionDelay: `${STAGGER_LIMIT * STAGGER_STEP_MS}ms` }}
        >
          <RoomProposalCard
            proposal={proposal}
            canDecide={canDecide}
            isDeciding={decidingOperationId === proposal.operationId}
            onDecide={onDecide}
          />
        </div>
      ))}

      {isThinking ? (
        <div className="room-message flex items-center gap-2 text-sm text-muted-foreground">
          <RoomThinkingDots />
          <span>{agentName} sedang berpikir</span>
        </div>
      ) : null}
    </div>
  );
}

type RoomMessageRowProps = {
  message: RoomListMessage;
  index: number;
  proposals: Record<string, RoomProposal>;
  canDecide: boolean;
  decidingOperationId: string | null;
  onDecide: (operationId: string, decision: 'approve' | 'reject') => void;
};

function RoomMessageRow({
  message,
  index,
  proposals,
  canDecide,
  decidingOperationId,
  onDecide,
}: RoomMessageRowProps) {
  const delay = `${Math.min(index, STAGGER_LIMIT) * STAGGER_STEP_MS}ms`;
  const proposal = message.operationId
    ? proposals[message.operationId]
    : undefined;

  if (message.authorType === 'user') {
    return (
      <div
        className="room-message flex flex-col items-end gap-1"
        style={{ transitionDelay: delay }}
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{message.authorName}</span>
          {message.pending ? <span>mengirim...</span> : null}
          <time
            dateTime={new Date(message.createdAt).toISOString()}
            title={formatRoomTimestamp(message.createdAt)}
          >
            {formatDistanceToNow(message.createdAt)}
          </time>
        </div>
        <div className="max-w-[85%] rounded-md border bg-muted px-3 py-2 text-sm whitespace-pre-wrap">
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div className="room-message space-y-1" style={{ transitionDelay: delay }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{message.authorName}</span>
        {message.authorType === 'agent' ? (
          <Badge variant="outline" className="h-5 gap-1 text-[11px]">
            <Bot className="h-3 w-3" />
            Agen
          </Badge>
        ) : null}
        {MESSAGE_KIND_LABEL[message.kind] ? (
          <Badge variant="secondary" className="h-5 text-[11px]">
            {MESSAGE_KIND_LABEL[message.kind]}
          </Badge>
        ) : null}
        <time
          className="text-xs text-muted-foreground"
          dateTime={new Date(message.createdAt).toISOString()}
          title={formatRoomTimestamp(message.createdAt)}
        >
          {formatDistanceToNow(message.createdAt)}
        </time>
      </div>
      <p className="text-sm whitespace-pre-wrap">{message.text}</p>
      {proposal ? (
        <RoomProposalCard
          proposal={proposal}
          canDecide={canDecide}
          isDeciding={decidingOperationId === proposal.operationId}
          onDecide={onDecide}
        />
      ) : null}
    </div>
  );
}
