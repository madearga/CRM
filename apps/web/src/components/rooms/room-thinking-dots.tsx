'use client';

import { cn } from '@/lib/utils';

/**
 * Three dots that pulse one after the other. The motion stops when the person
 * asks for less motion.
 */
export function RoomThinkingDots({ className }: { className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1', className)}
      aria-hidden="true"
    >
      <span className="room-thinking-dot size-1.5 rounded-full bg-current" />
      <span className="room-thinking-dot size-1.5 rounded-full bg-current" />
      <span className="room-thinking-dot size-1.5 rounded-full bg-current" />
    </span>
  );
}
