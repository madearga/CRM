/**
 * Pipeline-by-stage visual block for the mobile dashboard.
 *
 * A horizontal proportional stacked bar (5 stage segments, widths = each
 * stage's share of total deal count) over a compact chip row showing each
 * stage's count and formatted-currency value. The whole block is a
 * `Pressable` that deep-links to the deals tab (D5: blocks drill in, they are
 * not interactive surfaces).
 *
 * Pure nativewind `View`s — no chart library (D1). Stage colors come from the
 * shared `@crm/domain` map so mobile and web cannot drift. An optional ≤200ms
 * reanimated entrance is gated by `useReducedMotion`; the component renders
 * correctly without it.
 *
 * Empty state: when every stage count is zero the block renders a muted
 * "No pipeline data yet" line instead of an empty bar.
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
import { STAGE_CHART_COLORS, STAGE_DEFAULT_COLOR } from '@crm/domain';

export interface PipelineStageDatum {
  stage: string;
  count: number;
  value: number;
}

export interface PipelineBarProps {
  dealsByStage: PipelineStageDatum[];
  onPress: () => void;
  currency?: string;
  testID?: string;
}

const STAGE_ORDER = ['new', 'contacted', 'proposal', 'won', 'lost'];

const STAGE_LABEL: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  proposal: 'Proposal',
  won: 'Won',
  lost: 'Lost',
};

const ENTRANCE_MS = 180;

export function PipelineBar({
  dealsByStage,
  onPress,
  currency,
  testID,
}: PipelineBarProps) {
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

  const total = dealsByStage.reduce((sum, d) => sum + (d.count ?? 0), 0);
  const hasData = total > 0;

  // Stable order: known stages first (STAGE_ORDER), then any unknown stages.
  const known = STAGE_ORDER.map((stage) =>
    dealsByStage.find((d) => d.stage === stage),
  ).filter(Boolean) as PipelineStageDatum[];
  const unknown = dealsByStage.filter((d) => !STAGE_ORDER.includes(d.stage));
  const ordered = [...known, ...unknown];

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel="Pipeline by stage. Open deals."
      onPress={onPress}
      style={({ pressed }) =>
        ({ opacity: pressed ? 0.85 : undefined }) as ViewStyle
      }
    >
      <Animated.View style={entranceStyle}>
        <Card className="gap-3 p-4">
          <View className="flex-row items-center justify-between">
            <Text variant="body-sm" className="font-semibold uppercase tracking-wide">
              Pipeline
            </Text>
            <Text variant="caption">{total} deals</Text>
          </View>

          {hasData ? (
            <>
              <View
                className="h-2.5 w-full flex-row overflow-hidden rounded-full"
                accessibilityLabel={`Pipeline distribution across ${ordered.length} stages`}
              >
                {ordered.map((d) => {
                  const pct = total > 0 ? (d.count / total) * 100 : 0;
                  if (pct <= 0) return null;
                  return (
                    <View
                      key={d.stage}
                      style={{
                        width: `${pct}%`,
                        backgroundColor:
                          STAGE_CHART_COLORS[d.stage] ?? STAGE_DEFAULT_COLOR,
                      }}
                    />
                  );
                })}
              </View>

              <View className="flex-row flex-wrap gap-2">
                {ordered.map((d) => (
                  <View
                    key={d.stage}
                    className="flex-row items-center gap-1.5 rounded-md bg-muted px-2 py-1"
                  >
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        backgroundColor:
                          STAGE_CHART_COLORS[d.stage] ?? STAGE_DEFAULT_COLOR,
                      }}
                    />
                    <Text variant="caption" numberOfLines={1}>
                      {STAGE_LABEL[d.stage] ?? capitalize(d.stage)}
                    </Text>
                    <Text variant="caption" className="font-semibold">
                      {d.count}
                    </Text>
                    <Text variant="caption" className="text-muted-foreground">
                      {d.value > 0 ? formatCurrencyCompact(d.value, currency) : '—'}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <View className="items-center gap-1 py-3">
              <Ionicons name="bar-chart-outline" size={22} color={colors.mutedForeground} />
              <Text variant="muted">No pipeline data yet</Text>
            </View>
          )}
        </Card>
      </Animated.View>
    </Pressable>
  );
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}