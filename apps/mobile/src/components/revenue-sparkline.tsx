/**
 * 6-month revenue sparkline block for the mobile dashboard.
 *
 * A `flex-row` of up to 6 mini vertical bars (last 6 calendar months), heights
 * proportional to each month's revenue relative to the max month, with the
 * current (last) month highlighted. The existing Revenue-MTD figure stays the
 * headline number. The whole block is a `Pressable` that deep-links to the
 * invoices tab (D5).
 *
 * Pure nativewind `View`s — no chart library (D1). An optional ≤200ms reanimated
 * entrance is gated by `useReducedMotion`.
 *
 * Empty state: when every month's revenue is zero the block renders a muted
 * "No revenue yet" line instead of flat zero-height bars. Partial history
 * (fewer than 6 entries) renders only the available months — no zero-padded
 * ghost bars (the backend already zero-fills, so length drives the bar count).
 */
import { useEffect } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';

import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { formatCurrencyCompact } from '@/lib/format';
import { colors } from '@/styles/theme';

export interface RevenueMonthDatum {
  /** Epoch ms at the start of the calendar month. */
  month: number;
  revenue: number;
}

export interface RevenueSparklineProps {
  revenueByMonth: RevenueMonthDatum[];
  revenueMTD: number;
  onPress: () => void;
  currency?: string;
  testID?: string;
}

const MAX_BAR_HEIGHT = 56; // dp
const MIN_BAR_HEIGHT = 2; // dp — zero-revenue months still show a visible tick
const ENTRANCE_MS = 180;

const monthFormatter = (() => {
  try {
    return new Intl.DateTimeFormat('id-ID', { month: 'short' });
  } catch {
    return null;
  }
})();

function monthLabel(ms: number): string {
  try {
    if (monthFormatter) return monthFormatter.format(new Date(ms));
  } catch {
    // fall through
  }
  const d = new Date(ms);
  return `${d.getMonth() + 1}`;
}

export function RevenueSparkline({
  revenueByMonth,
  revenueMTD,
  onPress,
  currency,
  testID,
}: RevenueSparklineProps) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  const scale = useSharedValue(reduceMotion ? 1 : 0.97);

  useEffect(() => {
    if (reduceMotion) return;
    opacity.value = withTiming(1, { duration: ENTRANCE_MS });
    scale.value = withTiming(1, { duration: ENTRANCE_MS });
  }, [reduceMotion, opacity, scale]);

  const entranceStyle = useAnimatedStyle(
    () => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }),
    [opacity, scale],
  );

  const maxRevenue = revenueByMonth.reduce(
    (max, m) => (m.revenue > max ? m.revenue : max),
    0,
  );
  const hasRevenue = maxRevenue > 0;
  const lastIndex = revenueByMonth.length - 1;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`Revenue MTD ${formatCurrencyCompact(revenueMTD, currency)}. Open invoices.`}
      onPress={onPress}
      style={({ pressed }) =>
        ({ opacity: pressed ? 0.85 : undefined }) as ViewStyle
      }
    >
      <Animated.View style={entranceStyle}>
        <Card className="gap-3 p-4">
          <View className="flex-row items-end justify-between">
            <View>
              <Text variant="body-sm" className="font-semibold uppercase tracking-wide">
                Revenue MTD
              </Text>
              <Text variant="h2" numberOfLines={1} className="mt-1">
                {formatCurrencyCompact(revenueMTD, currency)}
              </Text>
            </View>
            <Text variant="caption">Last 6 months</Text>
          </View>

          {hasRevenue ? (
            <View
              className="flex-row items-end justify-between gap-2"
              style={{ height: MAX_BAR_HEIGHT + 16 }}
            >
              {revenueByMonth.map((m, i) => {
                const isCurrent = i === lastIndex;
                const h =
                  maxRevenue > 0
                    ? Math.max((m.revenue / maxRevenue) * MAX_BAR_HEIGHT, MIN_BAR_HEIGHT)
                    : MIN_BAR_HEIGHT;
                return (
                  <View key={m.month} className="flex-1 items-center gap-1">
                    <View
                      style={{
                        width: '100%',
                        height: h,
                        borderRadius: 3,
                        backgroundColor: isCurrent ? colors.primary : colors.mutedForeground,
                        opacity: isCurrent ? 1 : 0.55,
                      }}
                    />
                    <Text
                      variant="caption"
                      className={isCurrent ? 'font-semibold' : 'text-muted-foreground'}
                      numberOfLines={1}
                    >
                      {monthLabel(m.month)}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <View className="items-center gap-1 py-3">
              <Ionicons name="trending-up-outline" size={22} color={colors.mutedForeground} />
              <Text variant="muted">No revenue yet</Text>
            </View>
          )}
        </Card>
      </Animated.View>
    </Pressable>
  );
}