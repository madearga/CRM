'use client';

import { useState } from 'react';
import { useAuthQuery, useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
import { Activity, Plus, Phone, Mail, Calendar, FileText, ArrowRightLeft, Check, Clock, Inbox } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';

const ACTIVITY_ICONS: Record<string, typeof Phone> = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  note: FileText,
  status_change: ArrowRightLeft,
};

const ACTIVITY_BG_COLORS: Record<string, string> = {
  call: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
  email: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400',
  meeting: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
  note: 'bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-400',
  status_change: 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400',
};

export default function ActivitiesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newActivity, setNewActivity] = useState({
    title: '',
    description: '',
    type: 'note' as string,
    entityType: 'company' as string,
    entityId: '',
    dueAt: '',
  });

  const { data: recentActivities, isLoading: loadingRecent } = useAuthQuery(
    api.activities.listRecent,
    {}
  );
  const { data: upcomingActivities, isLoading: loadingUpcoming } = useAuthQuery(
    api.activities.listUpcoming,
    {}
  );

  const createActivity = useAuthMutation(api.activities.create);
  const completeActivity = useAuthMutation(api.activities.complete);

  const handleCreate = async () => {
    if (!newActivity.title.trim()) {
      toast.error('Title is required');
      return;
    }
    try {
      await createActivity.mutateAsync({
        title: newActivity.title.trim(),
        description: newActivity.description || undefined,
        type: newActivity.type as any,
        entityType: newActivity.entityType as any,
        entityId: newActivity.entityId || 'general',
        dueAt: newActivity.dueAt ? new Date(newActivity.dueAt).getTime() : undefined,
      });
      toast.success('Activity created');
      setNewActivity({ title: '', description: '', type: 'note', entityType: 'company', entityId: '', dueAt: '' });
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" />
              Log Activity
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log Activity</DialogTitle>
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
                    {['call', 'email', 'meeting', 'note'].map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Due date"
                  type="date"
                  value={newActivity.dueAt}
                  onChange={(e) => setNewActivity({ ...newActivity, dueAt: e.target.value })}
                />
              </div>
              <Button onClick={handleCreate} className="w-full" disabled={createActivity.isPending}>
                Create Activity
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Upcoming / Due */}
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Clock className="h-4 w-4" />
            Upcoming
          </h3>
          {loadingUpcoming ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !upcomingActivities?.length ? (
            <EmptyState
              icon={<Clock className="size-6" />}
              title="All caught up"
              description="No upcoming activities scheduled."
              className="py-8"
            />
          ) : (
            <div className="space-y-2">
              {upcomingActivities.map((activity: any) => {
                const Icon = ACTIVITY_ICONS[activity.type] ?? FileText;
                return (
                  <div key={activity._id} className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50">
                    <div className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${ACTIVITY_BG_COLORS[activity.type] ?? 'bg-gray-400/20'}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{activity.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Due: {format(new Date(activity.dueAt), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleComplete(activity._id)}>
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent */}
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Activity className="h-4 w-4" />
            Recent
          </h3>
          {loadingRecent ? (
            <div className="space-y-2">
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
            <div className="space-y-2">
              {recentActivities.map((activity: any) => {
                const Icon = ACTIVITY_ICONS[activity.type] ?? FileText;
                return (
                  <div key={activity._id} className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50">
                    <div className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${ACTIVITY_BG_COLORS[activity.type] ?? 'bg-gray-400/20'}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{activity.title}</p>
                      {activity.description && (
                        <p className="text-xs text-muted-foreground">{activity.description}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(activity._creationTime), { addSuffix: true })}
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
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
