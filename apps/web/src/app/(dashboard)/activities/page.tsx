'use client';

import { useState } from 'react';
import { useAuthQuery, useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Activity, Plus, Clock, Inbox, Check, CalendarClock,
  AlertTriangle,
} from 'lucide-react';
import { ActivityIconBadge, ACTIVITY_ICONS, ACTIVITY_COLORS } from '@/components/activities/activity-icon';
import { EmptyState } from '@/components/empty-state';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from '@/lib/format-date';

const PRIORITY_BADGE: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  medium: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
  high: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
};

export default function ActivitiesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tab, setTab] = useState('upcoming');
  const [newActivity, setNewActivity] = useState({
    title: '',
    description: '',
    type: 'call' as string,
    entityType: 'company' as string,
    entityId: '',
    dueAt: '',
    priority: 'medium' as string,
  });

  const { data: recentActivities, isLoading: loadingRecent } = useAuthQuery(
    api.activities.listRecent,
    {}
  );
  const { data: upcomingActivities, isLoading: loadingUpcoming } = useAuthQuery(
    api.activities.listUpcoming,
    {}
  );
  const { data: overdueActivities, isLoading: loadingOverdue } = useAuthQuery(
    api.activities.overdue,
    {}
  );
  const { data: plannedActivities, isLoading: loadingPlanned } = useAuthQuery(
    api.activities.upcoming,
    {}
  );

  const createActivity = useAuthMutation(api.activities.create);
  const scheduleActivity = useAuthMutation(api.activities.schedule);
  const completeActivity = useAuthMutation(api.activities.complete);
  const cancelActivity = useAuthMutation(api.activities.cancelActivity);

  const handleCreate = async () => {
    if (!newActivity.title.trim()) {
      toast.error('Title is required');
      return;
    }
    try {
      if (newActivity.dueAt) {
        await scheduleActivity.mutateAsync({
          title: newActivity.title.trim(),
          description: newActivity.description || undefined,
          type: newActivity.type as any,
          entityType: newActivity.entityType as any,
          entityId: newActivity.entityId || 'general',
          scheduledAt: new Date(newActivity.dueAt).getTime(),
          priority: newActivity.priority as any,
        });
      } else {
        await createActivity.mutateAsync({
          title: newActivity.title.trim(),
          description: newActivity.description || undefined,
          type: newActivity.type as any,
          entityType: newActivity.entityType as any,
          entityId: newActivity.entityId || 'general',
        });
      }
      toast.success('Activity created');
      setNewActivity({ title: '', description: '', type: 'call', entityType: 'company', entityId: '', dueAt: '', priority: 'medium' });
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to create activity');
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await completeActivity.mutateAsync({ id: id as any });
      toast.success('Activity completed');
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to complete');
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelActivity.mutateAsync({ id: id as any });
      toast.success('Activity cancelled');
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to cancel');
    }
  };

  const now = Date.now();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">My Activities</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" />
              Schedule New
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule Activity</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="Activity title *"
                value={newActivity.title}
                onChange={(e) => setNewActivity({ ...newActivity, title: e.target.value })}
              />
              <Textarea
                placeholder="Description"
                value={newActivity.description}
                onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                rows={2}
              />
              <div className="grid grid-cols-2 gap-3">
                <Select
                  value={newActivity.type}
                  onValueChange={(v) => setNewActivity({ ...newActivity, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {['call', 'email', 'meeting', 'task', 'note'].map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={newActivity.priority}
                  onValueChange={(v) => setNewActivity({ ...newActivity, priority: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Input
                placeholder="Scheduled date"
                type="datetime-local"
                value={newActivity.dueAt}
                onChange={(e) => setNewActivity({ ...newActivity, dueAt: e.target.value })}
              />
              <Button onClick={handleCreate} className="w-full" disabled={createActivity.isPending || scheduleActivity.isPending}>
                {newActivity.dueAt ? 'Schedule Activity' : 'Log Activity'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="upcoming" className="gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" />
            Upcoming
            {plannedActivities && plannedActivities.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 text-[10px] px-1.5">
                {plannedActivities.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="overdue" className="gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Overdue
            {overdueActivities && overdueActivities.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 text-[10px] px-1.5">
                {overdueActivities.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="recent" className="gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            Recent
          </TabsTrigger>
        </TabsList>

        {/* Upcoming Tab */}
        <TabsContent value="upcoming">
          {loadingPlanned ? (
            <div className="space-y-2 mt-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !plannedActivities?.length ? (
            <EmptyState
              icon={<CalendarClock className="size-6" />}
              title="All caught up"
              description="No upcoming activities scheduled."
              className="py-8"
            />
          ) : (
            <div className="space-y-2 mt-4">
              {plannedActivities.map((activity: any) => (
                <div key={activity._id} className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50">
                  <ActivityIconBadge type={activity.type} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.title}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {format(new Date(activity.scheduledAt ?? activity.dueAt), 'MMM d, yyyy')}
                      {activity.priority && (
                        <Badge variant="outline" className={`text-[10px] h-4 ${PRIORITY_BADGE[activity.priority] ?? ''}`}>
                          {activity.priority}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] h-4 capitalize">{activity.type}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7" onClick={() => handleComplete(activity._id)}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-destructive" onClick={() => handleCancel(activity._id)}>
                      ×
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Overdue Tab */}
        <TabsContent value="overdue">
          {loadingOverdue ? (
            <div className="space-y-2 mt-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !overdueActivities?.length ? (
            <EmptyState
              icon={<AlertTriangle className="size-6" />}
              title="No overdue activities"
              description="All planned activities are on schedule."
              className="py-8"
            />
          ) : (
            <div className="space-y-2 mt-4">
              {overdueActivities.map((activity: any) => {
                const due = activity.scheduledAt ?? activity.dueAt;
                const daysLate = due ? Math.floor((now - due) / (24 * 60 * 60 * 1000)) : 0;
                return (
                  <div key={activity._id} className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50/50 p-3 dark:border-red-800 dark:bg-red-950/30">
                    <ActivityIconBadge type={activity.type} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{activity.title}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="destructive" className="text-[10px] h-4">
                          {daysLate}d overdue
                        </Badge>
                        {activity.priority && (
                          <Badge variant="outline" className={`text-[10px] h-4 ${PRIORITY_BADGE[activity.priority] ?? ''}`}>
                            {activity.priority}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px] h-4 capitalize">{activity.type}</Badge>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7" onClick={() => handleComplete(activity._id)}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Recent Tab */}
        <TabsContent value="recent">
          {loadingRecent ? (
            <div className="space-y-2 mt-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !recentActivities?.length ? (
            <EmptyState
              icon={<Inbox className="size-6" />}
              title="No recent activity"
              description="Activities you log will appear here."
              className="py-8"
            />
          ) : (
            <div className="space-y-2 mt-4">
              {recentActivities.map((activity: any) => (
                <div key={activity._id} className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50">
                  <ActivityIconBadge type={activity.type} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.title}</p>
                    {activity.description && (
                      <p className="text-xs text-muted-foreground">{activity.description}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(activity._creationTime))}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs capitalize">{activity.type}</Badge>
                    {activity.completedAt ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs">done</Badge>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => handleComplete(activity._id)}>
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
