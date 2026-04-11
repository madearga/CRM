'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { DropResult } from '@hello-pangea/dnd';
import { useAuthQuery, useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { CreateDealDialog } from './create-deal-dialog';
import { LostReasonDialog } from './lost-reason-dialog';
import { STAGES, type StageId } from './stages';
import { isValidTransition } from '@crm/domain';

const DealsBoard = dynamic(() => import('./deals-board'), {
  ssr: false,
  loading: () => <DealsBoardSkeleton />,
});

function DealsBoardSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {STAGES.map((stage) => (
        <div
          key={stage.id}
          className={`flex min-w-[280px] flex-1 flex-col rounded-lg border p-4 ${stage.bg} ${stage.border}`}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">{stage.label}</h3>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stage.badge}`}>
              0
            </span>
          </div>
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-md bg-white/60" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DealsPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [lostDragInfo, setLostDragInfo] = useState<{
    dealId: string;
    sourceStage: StageId;
  } | null>(null);

  const { data: dealsByStage, isLoading } = useAuthQuery(
    api.deals.listByStage,
    {}
  );

  const updateStage = useAuthMutation(api.deals.updateStage, {
    onError: (error: any) => {
      toast.error(error.data?.message ?? 'Invalid stage transition');
    },
  });

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      const { destination, source, draggableId } = result;

      if (!destination) return;
      if (
        destination.droppableId === source.droppableId &&
        destination.index === source.index
      ) {
        return;
      }

      const sourceStage = source.droppableId as StageId;
      const targetStage = destination.droppableId as StageId;

      if (!isValidTransition(sourceStage, targetStage)) {
        toast.error(`Cannot move deal from "${sourceStage}" to "${targetStage}"`);
        return;
      }

      if (targetStage === 'lost') {
        setLostDragInfo({
          dealId: draggableId,
          sourceStage: source.droppableId as StageId,
        });
        return;
      }

      updateStage.mutate({
        id: draggableId as any,
        stage: targetStage,
      });
    },
    [updateStage]
  );

  const handleLostConfirm = (reason: string) => {
    if (!lostDragInfo) return;
    updateStage.mutate({
      id: lostDragInfo.dealId as any,
      stage: 'lost',
      lostReason: reason || undefined,
    });
    setLostDragInfo(null);
  };

  const handleLostCancel = () => {
    setLostDragInfo(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Add Deal
        </Button>
      </div>

      {isLoading ? (
        <DealsBoardSkeleton />
      ) : (
        <DealsBoard
          dealsByStage={dealsByStage}
          onDragEnd={handleDragEnd}
        />
      )}

      <CreateDealDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />

      <LostReasonDialog
        open={!!lostDragInfo}
        onConfirm={handleLostConfirm}
        onCancel={handleLostCancel}
      />
    </div>
  );
}
