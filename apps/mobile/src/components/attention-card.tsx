/**
 * Attention section — the "what needs my attention right now" block at the top
 * of the mobile dashboard.
 *
 * Surfaces two user-facing concerns, each a tappable row that deep-links into
 * its module:
 *   1. Overdue activities count  → /(app)/activities
 *   2. Overdue invoices total    → /(app)/invoices
 *
 * Visual priority follows severity: non-zero overdue counts use warning /
 * destructive tones so they stand out; a clean workspace renders muted, calm
 * rows. Each row meets the 48dp minimum touch target.
 */
import { Pressable, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { formatCurrencyCompact } from '@/lib/format';
import { colors } from '@/styles/theme';
import { cn } from '@/lib/utils';

export interface AttentionCardProps {
  overdueActivitiesCount: number;
  overdueInvoicesTotal: number;
  overdueInvoicesCurrency?: string;
  onPressActivities: () => void;
  onPressInvoices: () => void;
  testID?: string;
}

export function AttentionCard({
  overdueActivitiesCount,
  overdueInvoicesTotal,
  overdueInvoicesCurrency,
  onPressActivities,
  onPressInvoices,
  testID,
}: AttentionCardProps) {
  return (
    <Card testID={testID} className="gap-1 p-0">
      <View className="flex-row items-center justify-between px-5 pb-2 pt-4">
        <Text variant="body-sm" className="font-semibold uppercase tracking-wide">
          Needs attention
        </Text>
      </View>

      <AttentionRow
        label="Overdue activities"
        value={
          overdueActivitiesCount > 0
            ? `${overdueActivitiesCount}`
            : 'None'
        }
        tone={overdueActivitiesCount > 0 ? 'warning' : 'muted'}
        iconName="alert-circle-outline"
        onPress={onPressActivities}
        accessibilityLabel={`Overdue activities: ${overdueActivitiesCount}. Open activities.`}
      />

      <AttentionRow
        label="Overdue invoices"
        value={
          overdueInvoicesTotal > 0
            ? formatCurrencyCompact(
                overdueInvoicesTotal,
                overdueInvoicesCurrency
              )
            : 'None'
        }
        tone={overdueInvoicesTotal > 0 ? 'destructive' : 'muted'}
        iconName="warning-outline"
        onPress={onPressInvoices}
        accessibilityLabel={`Overdue invoices total: ${
          overdueInvoicesTotal > 0
            ? formatCurrencyCompact(
                overdueInvoicesTotal,
                overdueInvoicesCurrency
              )
            : 'none'
        }. Open invoices.`}
        divider={false}
      />
    </Card>
  );
}

type AttentionTone = 'warning' | 'destructive' | 'muted';

const toneValueClass: Record<AttentionTone, string> = {
  warning: 'text-warning',
  destructive: 'text-destructive',
  muted: 'text-muted-foreground',
};

const toneIconColor: Record<AttentionTone, string> = {
  warning: colors.warning,
  destructive: colors.destructive,
  muted: colors.mutedForeground,
};

function AttentionRow({
  label,
  value,
  tone,
  iconName,
  onPress,
  accessibilityLabel,
  divider = true,
}: {
  label: string;
  value: string;
  tone: AttentionTone;
  iconName: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  divider?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) =>
        ({ opacity: pressed ? 0.85 : undefined }) as ViewStyle
      }
    >
      <View
        className={cn(
          'min-h-12 flex-row items-center gap-3 px-5 py-3',
          divider && 'border-b border-border'
        )}
      >
        <Ionicons name={iconName} size={20} color={toneIconColor[tone]} />
        <Text variant="body" className="flex-1" numberOfLines={1}>
          {label}
        </Text>
        <Text
          variant="body-sm"
          className={cn('font-semibold', toneValueClass[tone])}
          numberOfLines={1}
        >
          {value}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
      </View>
    </Pressable>
  );
}
