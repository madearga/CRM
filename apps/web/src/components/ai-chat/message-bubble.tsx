'use client';

import { cn } from '@/lib/utils';
import { Bot, User } from 'lucide-react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: { name: string; args: Record<string, unknown> }[];
  isStreaming?: boolean;
}

interface MessageBubbleProps {
  message: ChatMessage;
}

function SimpleMarkdown({ content }: { content: string }) {
  // Basic markdown rendering: bold, italic, code, lists, tables
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inTable = false;
  let tableRows: string[][] = [];

  const renderInline = (text: string): React.ReactNode => {
    // Bold
    let parts = text.split(/\*\*(.+?)\*\*/g);
    parts = parts.flatMap((p) => p.split(/\*(.+?)\*/g));

    return parts.map((part, i) => {
      // Check if this part was preceded by ** or *
      const beforePart = text.substring(0, text.indexOf(part));
      if (beforePart.endsWith('**') && i % 2 === 1) {
        return <strong key={i}>{part}</strong>;
      }
      if (beforePart.endsWith('*') && !beforePart.endsWith('**') && i % 2 === 1) {
        return <em key={i}>{part}</em>;
      }
      // Inline code
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} className="rounded bg-muted px-1 py-0.5 text-xs">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  const flushTable = () => {
    if (tableRows.length === 0) return;
    elements.push(
      <div key={`table-${elements.length}`} className="my-2 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b">
              {tableRows[0]?.map((cell, ci) => (
                <th key={ci} className="px-2 py-1 text-left font-medium">
                  {renderInline(cell.trim())}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.slice(1).map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? 'bg-muted/30' : ''}>
                {row.map((cell, ci) => (
                  <td key={ci} className="px-2 py-1">
                    {renderInline(cell.trim())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableRows = [];
    inTable = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Table detection
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      if (!inTable) inTable = true;
      // Skip separator rows (|---|---|)
      if (line.match(/^\|[\s\-:|]+\|$/)) continue;
      const cells = line.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      tableRows.push(cells);
      continue;
    } else if (inTable) {
      flushTable();
    }

    // Headers
    if (line.startsWith('### ')) {
      elements.push(<h4 key={i} className="mt-3 mb-1 font-semibold">{renderInline(line.slice(4))}</h4>);
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(<h3 key={i} className="mt-3 mb-1 font-semibold">{renderInline(line.slice(3))}</h3>);
      continue;
    }

    // List items
    if (line.match(/^[-*]\s/)) {
      elements.push(
        <li key={i} className="ml-3 list-disc">
          {renderInline(line.replace(/^[-*]\s/, ''))}
        </li>
      );
      continue;
    }
    if (line.match(/^\d+\.\s/)) {
      elements.push(
        <li key={i} className="ml-3 list-decimal">
          {renderInline(line.replace(/^\d+\.\s/, ''))}
        </li>
      );
      continue;
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<div key={i} className="h-2" />);
      continue;
    }

    // Regular paragraph
    elements.push(<p key={i}>{renderInline(line)}</p>);
  }

  if (inTable) flushTable();

  return <div className="space-y-0.5">{elements}</div>;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-2 px-3 py-2', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2 text-sm',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        )}
      >
        {message.isStreaming && !message.content ? (
          <div className="flex items-center gap-1">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:0ms]" />
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:150ms]" />
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:300ms]" />
          </div>
        ) : (
          <SimpleMarkdown content={message.content} />
        )}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {message.toolCalls.map((tc, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-full bg-background/20 px-2 py-0.5 text-[10px]"
              >
                ⚡ {tc.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
