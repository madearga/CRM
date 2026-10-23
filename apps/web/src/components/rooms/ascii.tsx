'use client';

// ASCII accents for the room: the terminal-flavored details that make the
// agent surface feel made, not generated. Everything here is text — no icons,
// no animation libraries, no images. The spinner holds one braille frame and
// steps it with a timer; reduced motion freezes it on a static glyph.

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠉'];

export function AsciiSpinner({ label, className }: { label?: string; className?: string }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const timer = window.setInterval(() => setFrame((f) => (f + 1) % SPINNER_FRAMES.length), 110);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <span className={cn('inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground', className)}>
      <span aria-hidden className="w-3 text-center">
        {SPINNER_FRAMES[frame]}
      </span>
      {label ? <span>{label}</span> : null}
    </span>
  );
}

/** One of ◐ · ● · ○ by state: working, done, idle. */
export function StatusGlyph({ state, className }: { state: 'working' | 'done' | 'idle'; className?: string }) {
  const glyph = state === 'working' ? '◐' : state === 'done' ? '●' : '○';
  return (
    <span
      aria-hidden
      className={cn(
        'font-mono text-xs',
        state === 'working' && 'text-chart-1',
        state === 'done' && 'text-green-500',
        state === 'idle' && 'text-muted-foreground/50',
        className
      )}
    >
      {glyph}
    </span>
  );
}

/** Small monospace section marker: `▮ kolaborasi`. */
export function MonoTag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('font-mono text-[11px] tracking-normal text-muted-foreground/80', className)}>
      <span aria-hidden className="mr-1.5 text-foreground/40">
        ▮
      </span>
      {children}
    </span>
  );
}

/** A thin box-drawing frame for empty states: the message, framed. */
export function AsciiFrame({ lines, className }: { lines: string[]; className?: string }) {
  const width = Math.max(...lines.map((line) => line.length));
  const top = `┌${'─'.repeat(width + 2)}┐`;
  const bottom = `└${'─'.repeat(width + 2)}┘`;
  return (
    <pre
      aria-hidden
      className={cn('select-none font-mono text-[11px] leading-relaxed text-muted-foreground/60', className)}
    >
      {top + '\n'}
      {lines.map((line) => `│  ${line.padEnd(width, ' ')}  │\n`)}
      {bottom}
    </pre>
  );
}

/** Monospace operation id, e.g. `ops_7f3a2c` — short, stable, honest. */
export function OperationTag({ operationId, className }: { operationId: string; className?: string }) {
  const short = operationId.replace(/[^a-z0-9]/gi, '').slice(-6).toLowerCase();
  return (
    <span className={cn('font-mono text-[11px] text-muted-foreground/70', className)}>ops_{short}</span>
  );
}
