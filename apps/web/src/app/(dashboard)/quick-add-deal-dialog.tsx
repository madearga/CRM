'use client';

import { useState } from 'react';
import { useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface QuickAddDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickAddDealDialog({ open, onOpenChange }: QuickAddDealDialogProps) {
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');

  const createDeal = useAuthMutation(api.deals.create, {
    onSuccess: () => {
      toast.success('Deal created');
      setTitle('');
      setValue('');
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.data?.message ?? 'Failed to create deal');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) { toast.error('Title is required'); return; }
    if (trimmed.length > 200) { toast.error('Title must be 200 characters or less'); return; }
    const numValue = value ? Number(value) : undefined;
    if (numValue !== undefined && (isNaN(numValue) || numValue < 0)) { toast.error('Value must be a non-negative number'); return; }
    createDeal.mutate({
      title: trimmed,
      ...(numValue !== undefined ? { value: numValue } : {}),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quick Add Deal</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            placeholder="Deal title *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          <Input
            placeholder="Value (IDR)"
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createDeal.isPending || !title.trim()}>
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
