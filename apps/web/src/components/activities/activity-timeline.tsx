'use client';

import { useState } from 'react';
import { useAuthQuery, useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ActivityIconBadge } from './activity-icon';
import { ScheduleActivityDialog } from './schedule-activity-dialog';
import { Plus, Check, X, Clock, CalendarClock, CheckCircle2, XCircle } from 'lucide-react';
import { format } from '@/lib/format-date';
import { toast } from 'sonner';

type Filter = 'all' | 'planned' | 'done' | 'overdue';

interface ActivityTimelineProps {
  entityType: string;
  entityId: string;
}

const PRIORITY_BADGE: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  medium: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
  high: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
};

export function ActivityTimeline({ entityType, entityId }: ActivityTimelineProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: activities, isLoading } = useAuthQuery(
    api.activities.timeline,
    { entityType: entityType as any, entityId }
  );

  const completeMut = useAuthMutation(api.activities.complete);
  const cancelMut = useAuthMutation(api.activities.cancelActivity);

  const now = Date.now();

  const filtered = activities?.filter((a: any) => {
    switch (filter) {
      case 'planned':
        return a.status === 'planned' || (!a.status && !a.completedAt);
      case 'done':
        return a.status === 'done' || a.completedAt;
      case 'overdue': {
        const due = a.scheduledAt ?? a.dueAt;
        return (a.status === 'planned' || (!a.status && !a.completedAt)) && due != null && due < now;
      }
      default:
        return true;
    }
  });

  const handleComplete = async (id: string) => {
    try {
      await completeMut.mutateAsync({ id: id as any });
      toast.success('Activity completed');
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to complete');
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelMut.mutateAsync({ id: id as any });
      toast.success('Activity cancelled');
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to cancel');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <CalendarClock className="size-4" />
            Activities
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Schedule
          </Button>
        </div>
        <div className="flex gap-1 pt-1">
          {(['all', 'planned', 'overdue', 'done'] as Filter[]).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs capitalize"
              onClick={() => setFilter(f)}
            >
              {f}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !filtered?.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No activities found
          </p>
        ) : (
          <div className="relative space-y-0">
            {filtered.map((activity: any, idx: number) => {
              const isOverdue =
                (activity.status === 'planned' || (!activity.status && !activity.completedAt)) &&
                (activity.scheduledAt ?? activity.dueAt) != null &&
                (activity.scheduledAt ?? activity.dueAt) < now;
              const isDone = activity.status === 'done' || activity.completedAt;
              const isCancelled = activity.status === 'cancelled';

              return (
                <div key={activity._id} className="relative flex gap-3 pb-4">
                  {/* Timeline line */}
                  {idx < filtered.length - 1 && (
                    <div className="absolute left-[13px] top-7 bottom-0 w-px bg-border" />
                  )}

                  {/* Icon */}
                  <ActivityIconBadge type={activity.type} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`text-sm font-medium truncate ${isCancelled ? 'line-through text-muted-foreground' : ''}`}>
                          {activity.title}
                        </p>
                        {activity.description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {activity.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {activity.priority && (
                          <Badge variant="outline" className={`text-[10px] h-5 ${PRIORITY_BADGE[activity.priority] ?? ''}`}>
                            {activity.priority}
                          </Badge>
                        )}
                        {isDone && (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px] h-5">
                            <CheckCircle2 className="mr-0.5 h-3 w-3" />done
                          </Badge>
                        )}
                        {isCancelled && (
                          <Badge variant="secondary" className="bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 text-[10px] h-5">
                            <XCircle className="mr-0.5 h-3 w-3" />cancelled
                          </Badge>
                        )}
                        {isOverdue && (
                          <Badge variant="destructive" className="text-[10px] h-5">
                            overdue
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      {(activity.scheduledAt ?? activity.dueAt) && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(activity.scheduledAt ?? activity.dueAt), 'MMM d, yyyy')}
                        </span>
                      )}
                      <Badge variant="outline" className="text-[10px] capitalize h-4">
                        {activity.type}
                      </Badge>
                    </div>

                    {/* Action buttons for planned activities */}
                    {(activity.status === 'planned' || (!activity.status && !activity.completedAt)) && !isCancelled && (
                      <div className="mt-2 flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => handleComplete(activity._id)}
                          disabled={completeMut.isPending}
                        >
                          <Check className="mr-1 h-3 w-3" />
                          Complete
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs text-destructive hover:text-destructive"
                          onClick={() => handleCancel(activity._id)}
                          disabled={cancelMut.isPending}
                        >
                          <X className="mr-1 h-3 w-3" />
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <ScheduleActivityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entityType={entityType}
        entityId={entityId}
      />
    </Card>
  );
}
