/**
 * "More" tab — account summary and navigation to deeper settings.
 *
 * U8 turns this from a placeholder into a focused launchpad: user card at the
 * top, a settings row, and disabled placeholders for Phase 2 features. Tapping
 * Settings pushes the `settings.tsx` screen in the same tab.
 */
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/hooks/use-auth';
import { colors } from '@/styles/theme';

interface MenuRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  detail?: string;
}

function MenuRow({ icon, label, onPress, disabled, destructive, detail }: MenuRowProps) {
  const chevronColor = disabled ? colors.mutedForeground : colors.foreground;
  const iconColor = destructive ? colors.destructive : disabled ? colors.mutedForeground : colors.mutedForeground;
  const textColor = destructive ? 'text-destructive' : disabled ? 'text-muted-foreground' : 'text-foreground';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || !onPress }}
      className="min-h-14 flex-row items-center justify-between px-4 py-3 active:bg-muted/50"
    >
      <View className="flex-row items-center gap-3">
        <Ionicons name={icon} size={20} color={iconColor} accessibilityLabel={label} />
        <Text className={textColor}>{label}</Text>
      </View>
      <View className="flex-row items-center gap-2">
        {detail ? <Text variant="muted">{detail}</Text> : null}
        <Ionicons name="chevron-forward" size={18} color={chevronColor} />
      </View>
    </Pressable>
  );
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

  const goToSettings = () => router.navigate('/(app)/settings');

  return (
    <View className="flex-1 bg-background px-4 pt-6 gap-4">
      {/** Account summary card **/}
      <Card className="overflow-hidden">
        <CardContent className="flex-row items-center gap-4 py-5">
          <View
            className="h-14 w-14 items-center justify-center rounded-full bg-primary"
            accessibilityRole="image"
            accessibilityLabel={`Avatar for ${displayName}`}
          >
            <Text className="text-lg font-semibold text-primary-foreground">{initials}</Text>
          </View>
          <View className="flex-1 gap-0.5">
            <Text variant="h3">{displayName}</Text>
            {user?.email ? <Text variant="muted">{user.email}</Text> : null}
          </View>
        </CardContent>
      </Card>

      {/** Menu rows **/}
      <Card className="overflow-hidden">
        <MenuRow
          icon="settings-outline"
          label="Settings"
          onPress={goToSettings}
          detail="Account, workspace"
        />
        <View className="h-px bg-border mx-4" />
        <MenuRow
          icon="briefcase-outline"
          label="Deals"
          disabled
          detail="Phase 2"
        />
        <View className="h-px bg-border mx-4" />
        <MenuRow
          icon="people-outline"
          label="Contacts"
          onPress={() => router.push('/(app)/contacts')}
        />
        <View className="h-px bg-border mx-4" />
        <MenuRow
          icon="business-outline"
          label="Companies"
          onPress={() => router.push('/(app)/companies')}
        />
      </Card>
    </View>
  );
}
