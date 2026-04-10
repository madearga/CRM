'use client';

import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16', className)}>
      <div className="relative">
        {/* Decorative ring */}
        <div className="absolute inset-0 -m-4 rounded-full bg-muted/50" />
        <div className="relative flex size-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          {icon}
        </div>
      </div>
      <h3 className="mt-6 text-sm font-semibold">{title}</h3>
      {description && (
        <p className="mt-1 max-w-[260px] text-center text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
