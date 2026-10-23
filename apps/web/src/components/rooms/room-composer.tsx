'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Info, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';

const MAX_ROWS = 6;

export type RoomComposerProps = {
  canWrite: boolean;
  writeReason: string;
  isSending: boolean;
  /** Sends the text. It must throw when the send fails. */
  onSend: (text: string) => Promise<void>;
  /** Adds the message to the thread before the server answers. */
  onOptimistic: (text: string) => void;
};

/**
 * The composer sits under the thread. The field grows with the text, up to
 * six rows, and Enter sends the message.
 */
export function RoomComposer({
  canWrite,
  writeReason,
  isSending,
  onSend,
  onOptimistic,
}: RoomComposerProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const element = textareaRef.current;
    if (!element) return;

    element.style.height = 'auto';
    const styles = window.getComputedStyle(element);
    const lineHeight = parseFloat(styles.lineHeight) || 20;
    const padding =
      (parseFloat(styles.paddingTop) || 0) +
      (parseFloat(styles.paddingBottom) || 0);
    const border =
      (parseFloat(styles.borderTopWidth) || 0) +
      (parseFloat(styles.borderBottomWidth) || 0);
    const chrome = padding + border;
    const maxHeight = lineHeight * MAX_ROWS + chrome;

    element.style.height = `${Math.min(
      Math.max(element.scrollHeight, lineHeight + chrome),
      maxHeight
    )}px`;
    element.style.overflowY =
      element.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [text]);

  const handleSend = useCallback(async () => {
    const value = text.trim();
    if (!value || !canWrite || isSending) return;

    setText('');
    onOptimistic(value);

    try {
      await onSend(value);
    } catch (error) {
      setText(value);
      toast.error(
        error instanceof Error ? error.message : 'Gagal mengirim pesan'
      );
    }
  }, [text, canWrite, isSending, onSend, onOptimistic]);

  const disabled = !canWrite || isSending;
  const empty = text.trim().length === 0;

  return (
    <div className="space-y-2">
      <Label htmlFor="room-message-input" className="text-sm font-medium">
        Tulis pesan
      </Label>
      <Textarea
        id="room-message-input"
        ref={textareaRef}
        rows={1}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            void handleSend();
          }
        }}
        disabled={disabled}
        placeholder={
          canWrite
            ? 'Tulis pesan untuk ruang ini'
            : 'Anda tidak dapat menulis di ruang ini'
        }
        aria-describedby="room-composer-hint"
        maxLength={4000}
        className="room-composer-input text-sm"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        {canWrite ? (
          <p id="room-composer-hint" className="text-xs text-muted-foreground">
            Enter untuk mengirim, Shift+Enter untuk baris baru.
          </p>
        ) : (
          <p
            id="room-composer-hint"
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <Info className="h-3.5 w-3.5" />
            {writeReason}
          </p>
        )}
        <Button
          onClick={() => void handleSend()}
          disabled={disabled || empty}
          className="transition-transform duration-[160ms] ease-out active:scale-[0.97]"
        >
          {isSending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin duration-500" />
              Mengirim...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Kirim
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
