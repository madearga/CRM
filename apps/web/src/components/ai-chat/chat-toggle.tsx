'use client';

import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatToggleProps {
  onClick: () => void;
  isOpen: boolean;
}

export function ChatToggle({ onClick, isOpen }: ChatToggleProps) {
  if (isOpen) return null;

  return (
    <Button
      onClick={onClick}
      size="icon"
      className="fixed bottom-4 right-4 z-50 h-11 w-11 rounded-full shadow-lg"
    >
      <Sparkles className="h-5 w-5" />
    </Button>
  );
}
