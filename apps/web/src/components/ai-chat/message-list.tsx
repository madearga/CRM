'use client';

import { useRef, useEffect } from 'react';
import { type ChatMessage, MessageBubble } from './message-bubble';

interface MessageListProps {
  messages: ChatMessage[];
}

export function MessageList({ messages }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-muted-foreground">
        <div className="text-3xl">💬</div>
        <p className="text-sm font-medium">AI Assistant</p>
        <p className="text-center text-xs">
          Tanya apa saja tentang data CRM Anda.
          <br />
          Contoh: &quot;Siapa karyawan yang belum absen hari ini?&quot;
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
