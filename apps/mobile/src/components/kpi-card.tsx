/**
 * KPI card — a single metric tile for the dashboard analytics row.
 *
 * Semantics:
 *  - `label`:  caption above the value (e.g. "Open deals").
 *  - `value`:  the formatted metric (string — callers format currency/numbers).
 *  - `delta`:  optional period-over-period hint (rendered with a tone color).
 *  - `onPress`: makes the card a tappable 48dp-min touch target that navigates
 *    to the related module. Omit for non-navigable metrics.
 *
 * Uses the U4 `Card` primitive so styling stays consistent with the rest of the
 * app. Accessibility: tappable cards announce as a button with a label; static
 * cards announce as a group.
 */
import { Pressable, View, type ViewStyle } from 'react-native';

import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export type KpiDeltaTone = 'positive' | 'negative' | 'neutral';

export interface KpiCardProps {
  label: string;
  value: string;
  /** Optional delta, e.g. "+12% MoM". */
  delta?: string;
  deltaTone?: KpiDeltaTone;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
  className?: string;
}

const deltaToneClass: Record<KpiDeltaTone, string> = {
  positive: 'text-success',
  negative: 'text-destructive',
  neutral: 'text-muted-foreground',
};

export function KpiCard({
  label,
  value,
  delta,
  deltaTone = 'neutral',
  onPress,
  accessibilityLabel,
  testID,
  className,
}: KpiCardProps) {
  const inner = (
    <Card className={cn(onPress ? 'p-4' : undefined, className)}>
      <Text variant="caption" numberOfLines={1}>
        {label}
      </Text>
      <Text variant="h2" numberOfLines={1} className="mt-1.5">
        {value}
      </Text>
      {delta ? (
        <Text
          variant="caption"
          numberOfLines={1}
          className={cn('mt-1.5', deltaToneClass[deltaTone])}
        >
          {delta}
        </Text>
      ) : null}
    </Card>
  );

  if (!onPress) {
    return (
      <View
        accessibilityRole="summary"
        accessibilityLabel={accessibilityLabel ?? `${label}: ${value}`}
        testID={testID}
      >
        {inner}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${label}: ${value}`}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) =>
        ({ opacity: pressed ? 0.85 : undefined }) as ViewStyle
      }
    >
      {inner}
    </Pressable>
  );
}
