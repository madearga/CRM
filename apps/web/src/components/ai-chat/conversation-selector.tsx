'use client';

import { useState } from 'react';
import { Plus, MessageSquare, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface Conversation {
  id: string;
  title: string;
  updatedAt: number;
}

interface ConversationSelectorProps {
  conversations: Conversation[];
  currentId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export function ConversationSelector({
  conversations,
  currentId,
  onSelect,
  onNew,
}: ConversationSelectorProps) {
  const [open, setOpen] = useState(false);
  const current = conversations.find((c) => c.id === currentId);

  return (
    <div className="flex items-center gap-1 px-3 py-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 flex-1 justify-start gap-2 px-2 text-xs">
            <MessageSquare className="h-3 w-3 shrink-0" />
            <span className="truncate">{current?.title ?? 'New Chat'}</span>
            <ChevronDown className="ml-auto size-3 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-1">
          <div className="max-h-60 overflow-y-auto">
            {conversations.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                No conversations yet
              </p>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => {
                    onSelect(conv.id);
                    setOpen(false);
                  }}
                  className={`w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent ${
                    conv.id === currentId ? 'bg-accent font-medium' : ''
                  }`}
                >
                  <span className="line-clamp-1">{conv.title}</span>
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onNew}>
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
