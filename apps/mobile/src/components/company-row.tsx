/**
 * Company list row (P2.1, Task D).
 *
 * One row == one company. Dense + scannable:
 *   [business icon avatar]  name (truncates)        [status badge]
 *                           industry · country (muted)
 *
 * - Avatar: muted circle with `business-outline` glyph (companies have no
 *   initials). Matches the visual size of contact-row avatars (h-10 w-10).
 * - Status badge mapped to Badge variant; omitted when absent.
 * - `industry` + `country` joined with " · " when both present, else whichever
 *   exists. Falls back to nothing if neither is set.
 * - Static styling only (no animated/press-scale/hover classes). Press feedback
 *   via the `pressed` style callback.
 * - 44dp min touch target, accessibilityRole="button" + label.
 */
import { memo } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';
import { colors } from '@/styles/theme';

/** Company status → badge variant. Matches web CRM conventions. */
const statusBadgeVariant: Record<string, BadgeProps['variant']> = {
  active: 'success',
  customer: 'success',
  prospect: 'warning',
  lead: 'warning',
  churned: 'destructive',
  inactive: 'destructive',
};

const statusLabel: Record<string, string> = {
  active: 'Active',
  customer: 'Customer',
  prospect: 'Prospect',
  lead: 'Lead',
  churned: 'Churned',
  inactive: 'Inactive',
};

export interface CompanyRowItem {
  id: string;
  name: string;
  website?: string;
  industry?: string;
  size?: string;
  status?: string;
  country?: string;
  tags?: string[];
}

export const CompanyRow = memo(function CompanyRow({
  id,
  name,
  industry,
  status,
  country,
}: CompanyRowItem) {
  const router = useRouter();
  const variant = status ? statusBadgeVariant[status] : undefined;
  const label = status ? statusLabel[status] ?? status : undefined;

  const caption = [industry, country].filter(Boolean).join(' · ') || undefined;

  const a11y = [name, label, caption].filter(Boolean).join(', ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={() => router.push(`/companies/${id}`)}
      style={({ pressed }) =>
        ({ opacity: pressed ? 0.85 : undefined }) as ViewStyle
      }
    >
      <View className="min-h-11 flex-row items-center gap-3 px-4 py-3">
        {/* Business icon avatar */}
        <View
          className="h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: colors.muted }}
          accessibilityElementsHidden
        >
          <Ionicons
            name="business-outline"
            size={20}
            color={colors.mutedForeground}
          />
        </View>

        {/* Name + industry/country */}
        <View className="flex-1" style={{ rowGap: 2 }}>
          <Text variant="body" numberOfLines={1}>
            {name}
          </Text>
          {caption ? (
            <Text variant="caption" numberOfLines={1}>
              {caption}
            </Text>
          ) : null}
        </View>

        {/* Status badge */}
        {variant && label ? (
          <Badge variant={variant} className="shrink-0">
            {label}
          </Badge>
        ) : null}
      </View>
    </Pressable>
  );
});