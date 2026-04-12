'use client';

import { useState } from 'react';
import { useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

const ACTIVITY_TYPES = ['call', 'email', 'meeting', 'task', 'note'] as const;

interface ScheduleActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: string;
  entityId: string;
}

export function ScheduleActivityDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
}: ScheduleActivityDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<string>('call');
  const [scheduledAt, setScheduledAt] = useState('');
  const [priority, setPriority] = useState<string>('medium');
  const [autoSchedule, setAutoSchedule] = useState(false);
  const [nextDelay, setNextDelay] = useState('7');

  const scheduleActivity = useAuthMutation(api.activities.schedule);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!scheduledAt) {
      toast.error('Scheduled date is required');
      return;
    }

    try {
      await scheduleActivity.mutateAsync({
        title: title.trim(),
        description: description || undefined,
        type: type as any,
        entityType: entityType as any,
        entityId,
        scheduledAt: new Date(scheduledAt).getTime(),
        priority: priority as any,
        nextActivityType: autoSchedule ? type : undefined,
      });
      toast.success('Activity scheduled');
      resetForm();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to schedule activity');
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setType('call');
    setScheduledAt('');
    setPriority('medium');
    setAutoSchedule(false);
    setNextDelay('7');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Activity</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Title *</Label>
            <Input
              placeholder="e.g. Follow-up call"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              placeholder="Optional details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Scheduled Date *</Label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <Switch
              checked={autoSchedule}
              onCheckedChange={setAutoSchedule}
              id="auto-schedule"
            />
            <Label htmlFor="auto-schedule" className="text-sm">
              Auto-schedule next activity
            </Label>
            {autoSchedule && (
              <Input
                type="number"
                min={1}
                max={90}
                value={nextDelay}
                onChange={(e) => setNextDelay(e.target.value)}
                className="w-20"
                placeholder="days"
              />
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={scheduleActivity.isPending}>
              {scheduleActivity.isPending ? 'Scheduling...' : 'Schedule'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
