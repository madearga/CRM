'use client';

import { useState, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { useAuthQuery, useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { CreateDealDialog } from './create-deal-dialog';
import { LostReasonDialog } from './lost-reason-dialog';

const STAGES = [
  { id: 'new', label: 'New', bg: 'bg-slate-50', border: 'border-slate-200', badge: 'bg-slate-200 text-slate-800' },
  { id: 'contacted', label: 'Contacted', bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-200 text-blue-800' },
  { id: 'proposal', label: 'Proposal', bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-200 text-amber-800' },
  { id: 'won', label: 'Won', bg: 'bg-green-50', border: 'border-green-200', badge: 'bg-green-200 text-green-800' },
  { id: 'lost', label: 'Lost', bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-200 text-red-800' },
] as const;

type StageId = (typeof STAGES)[number]['id'];

interface Deal {
  _id: string;
  title: string;
  value?: number;
  currency?: string;
  probability?: number;
}

function formatCurrency(value: number, currency: string = 'IDR') {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency }).format(value);
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
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Deals</h1>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Deal
        </Button>
      </div>

      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map((stage) => (
            <div
              key={stage.id}
              className={`min-w-[280px] flex-1 rounded-lg border p-4 ${stage.bg} ${stage.border}`}
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">{stage.label}</h3>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stage.badge}`}>
                  0
                </span>
              </div>
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-20 animate-pulse rounded-md bg-white/60"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STAGES.map((stage) => {
              const deals: Deal[] =
                (dealsByStage as any)?.[stage.id] ?? [];

              return (
                <div
                  key={stage.id}
                  className={`min-w-[280px] flex-1 rounded-lg border p-4 ${stage.bg} ${stage.border}`}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold">{stage.label}</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${stage.badge}`}
                    >
                      {deals.length}
                    </span>
                  </div>

                  <Droppable droppableId={stage.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`min-h-[120px] space-y-2 rounded-md transition-colors ${
                          snapshot.isDraggingOver
                            ? 'bg-white/50'
                            : ''
                        }`}
                      >
                        {deals.map((deal, index) => (
                          <Draggable
                            key={deal._id}
                            draggableId={deal._id}
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <Card
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`cursor-grab border bg-white shadow-sm transition-shadow ${
                                  snapshot.isDragging
                                    ? 'shadow-lg'
                                    : 'hover:shadow-md'
                                }`}
                              >
                                <CardContent className="p-3">
                                  <p className="font-medium leading-snug">
                                    {deal.title}
                                  </p>
                                  <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
                                    {deal.value != null ? (
                                      <span>
                                        {formatCurrency(
                                          deal.value,
                                          deal.currency || 'IDR'
                                        )}
                                      </span>
                                    ) : (
                                      <span>—</span>
                                    )}
                                    {deal.probability != null && (
                                      <Badge variant="secondary" className="text-xs">
                                        {deal.probability}%
                                      </Badge>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
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
