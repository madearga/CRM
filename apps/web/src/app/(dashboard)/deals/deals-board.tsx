'use client';

import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { formatCurrency } from '@/lib/format';
import { STAGES } from './stages';

interface Deal {
  id: string;
  title: string;
  value?: number;
  currency?: string;
  probability?: number;
  stageEnteredAt?: number;
  ownerId: string;
}

function formatStageDuration(stageEnteredAt?: number): string | null {
  if (!stageEnteredAt) return null;
  const days = Math.floor((Date.now() - stageEnteredAt) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return '1d';
  return `${days}d`;
}

interface DealsBoardProps {
  dealsByStage: Record<string, Deal[]> | null | undefined;
  onDragEnd: (result: DropResult) => void;
}

export default function DealsBoard({ dealsByStage, onDragEnd }: DealsBoardProps) {
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => {
          const deals: Deal[] = dealsByStage?.[stage.id as keyof typeof dealsByStage] ?? [];

          return (
            <div
              key={stage.id}
              className={`flex min-w-[280px] flex-1 flex-col rounded-lg border p-4 ${stage.bg} ${stage.border}`}
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">{stage.label}</h3>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stage.badge}`}>
                  {deals.length}
                </span>
              </div>

              <Droppable droppableId={stage.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`min-h-[120px] flex-1 space-y-2 overflow-y-auto rounded-md transition-colors ${
                      snapshot.isDraggingOver ? 'bg-black/5 dark:bg-white/10' : ''
                    }`}
                    style={{ maxHeight: 'calc(100vh - 260px)' }}
                  >
                    {deals.map((deal, index) => {
                      const duration = formatStageDuration(deal.stageEnteredAt);
                      return (
                        <Draggable key={deal.id} draggableId={deal.id} index={index}>
                          {(provided, snapshot) => (
                            <Card
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`cursor-grab border bg-white shadow-sm transition-shadow dark:bg-slate-800/90 ${
                                snapshot.isDragging ? 'shadow-lg' : 'hover:shadow-md'
                              }`}
                            >
                              <CardContent className="p-3">
                                <Link href={`/deals/${deal.id}`} className="block">
                                  <p className="font-medium leading-snug hover:text-indigo-600 dark:hover:text-indigo-400">
                                    {deal.title}
                                  </p>
                                </Link>
                                <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
                                  {deal.value != null ? (
                                    <span>{formatCurrency(deal.value, deal.currency || 'IDR')}</span>
                                  ) : (
                                    <span>—</span>
                                  )}
                                  <div className="flex items-center gap-1">
                                    {deal.probability != null ? (
                                      <Badge variant="secondary" className="text-xs">
                                        {deal.probability}%
                                      </Badge>
                                    ) : null}
                                    {duration ? (
                                      <Badge
                                        variant="outline"
                                        className={`text-xs ${
                                          (Date.now() - (deal.stageEnteredAt ?? 0)) / 86_400_000 > 14
                                            ? 'border-amber-300 text-amber-600'
                                            : ''
                                        }`}
                                      >
                                        {duration}
                                      </Badge>
                                    ) : null}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}
