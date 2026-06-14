/**
 * Compact activity row — used on the dashboard (recent activities) and the
 * activities list (U6). One row == one activity the user owes.
 *
 * Layout (single line per activity, dense and scannable):
 *   [type badge]   title (truncates)            due (relative + overdue tone)
 *
 * - The type badge maps activity types (call/email/meeting/note/status_change)
 *   to a Badge variant so the row reads at a glance without icons.
 * - The due date uses `formatDistanceToNow` ("in 2 days" / "2 days ago"). Past
 *   dues render in destructive so overdue items pop; future dues are muted.
 * - Invalid timestamps (NaN) render `'—'` and never crash (plan edge case).
 * - Tappable rows meet the 48dp minimum touch target.
 */
import { memo } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';

import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';
import { formatDistanceToNow } from '@/lib/format-date';
import { cn } from '@/lib/utils';

export type ActivityType =
  | 'call'
  | 'email'
  | 'meeting'
  | 'note'
  | 'status_change'
  | 'task'
  | string;

const typeBadgeVariant: Record<string, BadgeProps['variant']> = {
  call: 'default',
  email: 'outline',
  meeting: 'success',
  note: 'secondary',
  status_change: 'warning',
  task: 'warning',
};

const typeLabel: Record<string, string> = {
  call: 'Call',
  email: 'Email',
  meeting: 'Meeting',
  note: 'Note',
  status_change: 'Update',
  task: 'Task',
};

export interface ActivityRowProps {
  title: string;
  type: ActivityType;
  /** Epoch ms of the due date. Invalid values render `'—'`. */
  dueAt: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
}

export const ActivityRow = memo(function ActivityRow({
  title,
  type,
  dueAt,
  onPress,
  accessibilityLabel,
  testID,
}: ActivityRowProps) {
  const timestamp = typeof dueAt === 'number' ? dueAt : NaN;
  const isOverdue = Number.isFinite(timestamp) && timestamp < Date.now();
  const dueText = formatDistanceToNow(timestamp);

  const variant = typeBadgeVariant[type] ?? 'secondary';
  const label = typeLabel[type] ?? capitalize(type);

  const content = (
    <View className="min-h-12 flex-row items-center gap-3 py-2.5">
      <Badge variant={variant} className="shrink-0">
        {label}
      </Badge>
      <Text variant="body" className="flex-1" numberOfLines={1}>
        {title}
      </Text>
      <Text
        variant="caption"
        numberOfLines={1}
        className={cn(
          'shrink-0',
          isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'
        )}
      >
        {dueText}
      </Text>
    </View>
  );

  if (!onPress) {
    return (
      <View testID={testID} accessibilityLabel={accessibilityLabel ?? `${label}: ${title}`}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ?? `${label}: ${title}, due ${dueText}`
      }
      onPress={onPress}
      style={({ pressed }) =>
        ({ opacity: pressed ? 0.85 : undefined }) as ViewStyle
      }
    >
      {content}
    </Pressable>
  );
});

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
