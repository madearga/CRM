/**
 * "More" tab — account summary + sectioned feature navigation.
 *
 * Settings is NOT a row here — it lives as a gear icon on the far-right of the
 * header (see `SettingsGearAction` in `(app)/_layout.tsx`). That keeps this list
 * focused on feature navigation, which scales cleanly as Phase 2 adds more
 * rows (Products, Payments, Sales Orders, HR…). Features are grouped into
 * labeled sections so a growing list stays scannable instead of one long slab.
 */
import { Pressable, ScrollView, View, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/hooks/use-auth';
import { colors } from '@/styles/theme';

type IconName = keyof typeof Ionicons.glyphMap;

interface MenuRowProps {
  icon: IconName;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  /** Small pill on the trailing side for disabled rows, e.g. "Coming soon". */
  badge?: string;
}

/**
 * Feature row: icon chip + label, trailing chevron (enabled) or badge
 * (disabled). 56dp min touch target, accessibilityRole + label, static press
 * feedback (no animated/active-scale classes — Reanimated makeMutable crashes
 * Expo Go).
 */
function MenuRow({ icon, label, onPress, disabled, badge }: MenuRowProps) {
  const enabled = !disabled && !!onPress;
  const iconColor = enabled ? colors.foreground : colors.mutedForeground;
  const chipBg = enabled ? colors.muted : colors.muted; // same surface; row text conveys state
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

function Divider() {
  return <View className="h-px bg-border mx-4" />;
}

export default function MoreScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const displayName = user?.name ?? user?.email ?? 'Account';
  const initials = (user?.name ?? user?.email ?? '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-4 pb-10 pt-4 gap-3"
    >
      {/** Account summary card **/}
      <Card className="overflow-hidden">
        <CardContent className="flex-row items-center gap-4 py-5">
          <View
            className="h-14 w-14 items-center justify-center rounded-full bg-primary"
            accessibilityRole="image"
            accessibilityLabel={`Avatar for ${displayName}`}
          >
            <Text className="text-lg font-semibold text-primary-foreground">
              {initials}
            </Text>
          </View>
          <View className="flex-1 gap-0.5">
            <Text variant="h3">{displayName}</Text>
            {user?.email ? <Text variant="muted">{user.email}</Text> : null}
          </View>
        </CardContent>
      </Card>

      {/** CRM — people + organizations **/}
      <SectionHeader title="CRM" />
      <Card className="overflow-hidden">
        <MenuRow
          icon="people-outline"
          label="Contacts"
          onPress={() => router.push('/(app)/contacts')}
        />
        <Divider />
        <MenuRow
          icon="business-outline"
          label="Companies"
          onPress={() => router.push('/(app)/companies')}
        />
      </Card>

      {/** Pipeline — revenue in motion **/}
      <SectionHeader title="Pipeline" />
      <Card className="overflow-hidden">
        <MenuRow icon="briefcase-outline" label="Deals" disabled badge="Coming soon" />
      </Card>
    </ScrollView>
  );
}