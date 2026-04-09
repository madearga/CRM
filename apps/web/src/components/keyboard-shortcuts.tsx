'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const SHORTCUTS = [
  { keys: ['C'], action: 'Go to Companies', href: '/companies' },
  { keys: ['D'], action: 'Go to Deals', href: '/deals' },
  { keys: ['N'], action: 'Go to Contacts', href: '/contacts' },
  { keys: ['A'], action: 'Go to Activities', href: '/activities' },
  { keys: ['S'], action: 'Go to Settings', href: '/settings' },
  { keys: ['H'], action: 'Go to Dashboard', href: '/' },
  { keys: ['?'], action: 'Show keyboard shortcuts', href: null },
] as const;

export function KeyboardShortcuts() {
  const router = useRouter();
  const [showHelp, setShowHelp] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore if user is typing in an input, textarea, or contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      // Ignore if modifier keys are pressed
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();

      if (key === '?') {
        e.preventDefault();
        setShowHelp((prev) => !prev);
        return;
      }

      const shortcut = SHORTCUTS.find((s) => s.keys[0].toLowerCase() === key);
      if (shortcut?.href) {
        e.preventDefault();
        router.push(shortcut.href);
      }
    },
    [router]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <Dialog open={showHelp} onOpenChange={setShowHelp}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {SHORTCUTS.map((shortcut) => (
            <div
              key={shortcut.keys[0]}
              className="flex items-center justify-between"
            >
              <span className="text-sm">{shortcut.action}</span>
              <kbd className="rounded border bg-muted px-2 py-0.5 font-mono text-xs">
                {shortcut.keys[0]}
              </kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
