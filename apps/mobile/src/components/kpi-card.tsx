/**
 * KPI card — a single metric tile for the dashboard analytics row.
 *
 * `label` is the caption above the formatted `value`. Uses the U4 `Card`
 * primitive so styling stays consistent with the rest of the app. Static
 * (non-navigable): announce as a summary group.
 *
 * ponytail: delta/tone + tappable variant removed — no call site uses them.
 * Re-add a `delta`/`onPress` variant when a dashboard metric needs it.
 */
import { View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';

export interface KpiCardProps {
  label: string;
  value: string;
  accessibilityLabel?: string;
  testID?: string;
}

export function KpiCard({ label, value, accessibilityLabel, testID }: KpiCardProps) {
  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={accessibilityLabel ?? `${label}: ${value}`}
      testID={testID}
    >
      <Card className="p-4">
        <Text variant="caption" numberOfLines={1}>
          {label}
        </Text>
        <Text variant="h2" numberOfLines={1} className="mt-1.5">
          {value}
        </Text>
      </Card>
    </View>
  );
}