'use client';

import {
  Phone,
  Mail,
  Calendar,
  FileText,
  CheckSquare,
  ArrowRightLeft,
  type LucideIcon,
} from 'lucide-react';

export const ACTIVITY_ICONS: Record<string, LucideIcon> = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  note: FileText,
  status_change: ArrowRightLeft,
  task: CheckSquare,
};

export const ACTIVITY_COLORS: Record<string, string> = {
  call: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
  email: 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400',
  meeting: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400',
  note: 'bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-400',
  status_change: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
  task: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
};

interface ActivityIconProps {
  type: string;
  className?: string;
}

export function ActivityIcon({ type, className }: ActivityIconProps) {
  const Icon = ACTIVITY_ICONS[type] ?? FileText;
  return <Icon className={className ?? 'h-4 w-4'} />;
}

export function ActivityIconBadge({ type }: { type: string }) {
  const Icon = ACTIVITY_ICONS[type] ?? FileText;
  return (
    <div
      className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
        ACTIVITY_COLORS[type] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
    </div>
  );
}
