'use client';

import { X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MessageList } from './message-list';
import { ChatInput } from './chat-input';
import { ConversationSelector } from './conversation-selector';
import { type ChatMessage } from './message-bubble';

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSend: (message: string) => void;
  conversations: { id: string; title: string; updatedAt: number }[];
  currentConversationId?: string;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
}

export function ChatPanel({
  messages,
  isLoading,
  isOpen,
  onClose,
  onSend,
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
}: ChatPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="flex h-full w-[380px] shrink-0 flex-col border-l bg-background max-sm:fixed max-sm:inset-0 max-sm:z-50 max-sm:w-full max-sm:border-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-1">
        <ConversationSelector
          conversations={conversations}
          currentId={currentConversationId}
          onSelect={onSelectConversation}
          onNew={onNewConversation}
        />
        <div className="flex items-center gap-1 pr-1">
          <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            <Sparkles className="h-2.5 w-2.5" />
            Owner
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <MessageList messages={messages} />

      {/* Input */}
      <ChatInput onSend={onSend} isLoading={isLoading} />
    </div>
  );
}
