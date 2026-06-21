/**
 * CRM hub — Contacts + Companies (and future pipeline features).
 *
 * Replaces the old "More" tab. Settings now lives as its own bottom-tab
 * (far-right), so this screen stays focused on CRM feature navigation.
 */
import { Pressable, ScrollView, View, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { colors } from '@/styles/theme';

type IconName = keyof typeof Ionicons.glyphMap;

interface MenuRowProps {
  icon: IconName;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  /** Accent color for the icon chip so each row has its own visual identity. */
  chipTint?: string;
  /** Small pill on the trailing side for disabled rows, e.g. "Coming soon". */
  badge?: string;
}

/**
 * Feature row: icon chip + label, trailing chevron (enabled) or badge
 * (disabled). 56dp min touch target, accessibilityRole + label, static press
 * feedback (no animated/active-scale classes — Reanimated makeMutable crashes
 * Expo Go).
 */
function MenuRow({ icon, label, onPress, disabled, badge, chipTint }: MenuRowProps) {
  const enabled = !disabled && !!onPress;
  const iconColor = enabled ? colors.foreground : colors.mutedForeground;
  const chipBg = chipTint ?? colors.muted;
  const textColor = enabled ? 'text-foreground' : 'text-muted-foreground';
  const chevronColor = enabled ? colors.foreground : colors.mutedForeground;

  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      style={({ pressed }) =>
        ({ opacity: enabled && pressed ? 0.7 : undefined }) as ViewStyle
      }
    >
      <View className="min-h-14 flex-row items-center justify-between gap-3 px-4 py-3">
        <View className="flex-row flex-1 items-center gap-3">
          <View
            className="h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: chipBg }}
            accessibilityElementsHidden
          >
            <Ionicons name={icon} size={18} color={iconColor} />
          </View>
          <Text className={textColor}>{label}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          {badge ? (
            <Badge variant="outline" className="shrink-0">
              {badge}
            </Badge>
          ) : null}
          {enabled ? (
            <Ionicons name="chevron-forward" size={18} color={chevronColor} />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/** Small uppercase section label. */
function SectionHeader({ title }: { title: string }) {
  return (
    <Text
      variant="caption"
      className="px-4 pb-1.5 pt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
    >
      {title}
    </Text>
  );
}

export default function CrmHubScreen() {
  const router = useRouter();

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-4 pb-10 pt-4 gap-3"
    >
      <Text variant="h1" className="pb-1">CRM</Text>

      {/** CRM — people + organizations */}
      <SectionHeader title="Directory" />
      <Card className="overflow-hidden">
        <MenuRow
          icon="person-circle-outline"
          label="Contacts"
          chipTint="rgba(59,130,246,0.15)"
          onPress={() => router.push('/(app)/contacts')}
        />
        <View className="h-px bg-border mx-4" />
        <MenuRow
          icon="business-outline"
          label="Companies"
          chipTint="rgba(34,197,94,0.15)"
          onPress={() => router.push('/(app)/companies')}
        />
      </Card>

      {/** Pipeline — revenue in motion */}
      <SectionHeader title="Pipeline" />
      <Card className="overflow-hidden">
        <MenuRow icon="trending-up-outline" label="Deals" disabled badge="Coming soon" chipTint="rgba(249,115,22,0.15)" />
      </Card>
    </ScrollView>
  );
}
