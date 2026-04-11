'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useAuthQuery, useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { CreateDealDialog } from './create-deal-dialog';
import { LostReasonDialog } from './lost-reason-dialog';

const DealsBoard = dynamic(() => import('./deals-board'), {
  ssr: false,
  loading: () => <DealsBoardSkeleton />,
});

type StageId = 'new' | 'contacted' | 'proposal' | 'won' | 'lost';

function DealsBoardSkeleton() {
  const stages = [
    { id: 'new', label: 'New', bg: 'bg-slate-50 dark:bg-slate-900/50', border: 'border-slate-200 dark:border-slate-700', badge: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200' },
    { id: 'contacted', label: 'Contacted', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', badge: 'bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200' },
    { id: 'proposal', label: 'Proposal', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', badge: 'bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200' },
    { id: 'won', label: 'Won', bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', badge: 'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200' },
    { id: 'lost', label: 'Lost', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', badge: 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200' },
  ];

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {stages.map((stage) => (
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
    (result: { destination: { droppableId: string; index: number } | null; source: { droppableId: string; index: number }; draggableId: string }) => {
      const { destination, source, draggableId } = result;

      if (!destination) return;
      if (
        destination.droppableId === source.droppableId &&
        destination.index === source.index
      ) {
        return;
      }

      const targetStage = destination.droppableId as StageId;

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
