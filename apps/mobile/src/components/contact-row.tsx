/**
 * Contact list row (P2.1, Task B).
 *
 * One row == one contact. Dense + scannable:
 *   [initials avatar]  fullName (truncates)            [lifecycle badge]
 *                      jobTitle (muted)                [• last-touch dot]
 *
 * - Avatar: circle with initials (first letters of first + last name).
 * - Last-touch dot: green when `lastTouchStatus==='green'`, red otherwise.
 * - Lifecycle badge mapped to Badge variant; omitted when absent.
 * - Static styling only (no animated/press-scale/hover classes). Press feedback via
 *   the `pressed` style callback (matches activity-row).
 * - 44dp min touch target, accessibilityRole="button" + label.
 */
import { memo } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';

import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';
import { colors } from '@/styles/theme';
import { cn } from '@/lib/utils';

/** Lifecycle stage → badge variant. Matches the web CRM conventions. */
const lifecycleBadgeVariant: Record<string, BadgeProps['variant']> = {
  lead: 'outline',
  prospect: 'warning',
  customer: 'success',
  churned: 'destructive',
};

const lifecycleLabel: Record<string, string> = {
  lead: 'Lead',
  prospect: 'Prospect',
  customer: 'Customer',
  churned: 'Churned',
};

export interface ContactRowItem {
  id: string;
  fullName: string;
  jobTitle?: string;
  lastTouchStatus: 'green' | 'red';
  lifecycleStage?: 'lead' | 'prospect' | 'customer' | 'churned';
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return (first + last).toUpperCase() || '?';
}

export const ContactRow = memo(function ContactRow({
  id,
  fullName,
  jobTitle,
  lastTouchStatus,
  lifecycleStage,
}: ContactRowItem) {
  const router = useRouter();
  const initials = initialsFrom(fullName);
  const dotColor = lastTouchStatus === 'green' ? colors.success : colors.destructive;
  const stageVariant = lifecycleStage ? lifecycleBadgeVariant[lifecycleStage] : undefined;
  const stageLabel = lifecycleStage ? lifecycleLabel[lifecycleStage] : undefined;

  const a11y = [
    fullName,
    jobTitle,
    stageLabel,
    lastTouchStatus === 'green' ? 'up to date' : 'needs follow-up',
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={() => router.push(`/contacts/${id}`)}
      style={({ pressed }) =>
        ({ opacity: pressed ? 0.85 : undefined }) as ViewStyle
      }
    >
      <View className="min-h-11 flex-row items-center gap-3 px-4 py-3">
        {/* Avatar */}
        <View
          className="h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: colors.muted }}
        >
          <Text variant="body-sm" className="font-semibold text-foreground">
            {initials}
          </Text>
        </View>

        {/* Name + job title */}
        <View className="flex-1 gap-0.5" style={{ rowGap: 2 }}>
          <Text variant="body" numberOfLines={1}>
            {fullName}
          </Text>
          {jobTitle ? (
            <Text variant="caption" numberOfLines={1}>
              {jobTitle}
            </Text>
          ) : null}
        </View>

        {/* Last-touch dot */}
        <View
          accessibilityLabel={
            lastTouchStatus === 'green' ? 'Up to date' : 'Needs follow-up'
          }
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: dotColor }}
        />

        {/* Lifecycle badge */}
        {stageVariant && stageLabel ? (
          <Badge variant={stageVariant} className="shrink-0">
            {stageLabel}
          </Badge>
        ) : null}
      </View>
    </Pressable>
  );
});